import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import test from 'node:test';

const runLiveIntegration = process.env.PIXSOLVE_LIVE_INTEGRATION === '1';
const integrationDbUri = process.env.PIXSOLVE_INTEGRATION_DB_URI;
const lifecyclePath = '/api/v1/image-processing/jobs';

const waitFor = async (predicate, { timeoutMs = 45_000, intervalMs = 250 } = {}) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const value = await predicate();
    if (value) return value;

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out after ${timeoutMs}ms`);
};

test(
  'runs the V1 job lifecycle through HTTP, MongoDB, BullMQ, a separate worker, Sharp, and Cloudinary',
  { skip: !runLiveIntegration, timeout: 90_000 },
  async () => {
    assert.ok(
      integrationDbUri,
      'PIXSOLVE_INTEGRATION_DB_URI is required for the live integration check'
    );
    assert.match(
      integrationDbUri,
      /pixsolve[-_]integration/i,
      'PIXSOLVE_INTEGRATION_DB_URI must name a dedicated pixsolve integration database'
    );

    // This file is run without test-support/setup-env.js so real Cloudinary
    // credentials can come from .env. Set DB_URI before importing app modules,
    // which initialize Mongoose and the BullMQ queue from environment config.
    process.env.DB_URI = integrationDbUri;
    process.env.LOG_LEVEL = 'fatal';

    const [
      { default: jwt },
      { default: mongoose },
      { default: request },
      { default: sharp },
      { default: app },
      { default: config },
      { default: connectToDB },
      { default: Job },
      { default: User },
      queueModule,
      storageModule
    ] = await Promise.all([
      import('jsonwebtoken'),
      import('mongoose'),
      import('supertest'),
      import('sharp'),
      import('../src/app.js'),
      import('../src/config/env.js'),
      import('../src/config/database.js'),
      import('../src/models/job.js'),
      import('../src/models/user.js'),
      import('../src/queues/image-processing-queue.js'),
      import('../src/storage/cloudinary-storage.js')
    ]);

    const {
      imageProcessingQueue,
      shutdownImageProcessingQueue
    } = queueModule;
    const { deleteImage } = storageModule;
    const createdJobIds = [];
    const createdUserIds = [];
    let worker;
    let workerOutput = '';
    let databaseConnected = false;

    const stopWorker = async () => {
      if (!worker || worker.exitCode !== null || worker.signalCode !== null) return;

      worker.kill('SIGTERM');
      await once(worker, 'exit');
    };

    try {
      await connectToDB(config.dbUri);
      databaseConnected = true;

      const [owner, otherUser] = await User.create([
        {
          name: 'Integration Owner',
          email: `integration-owner-${Date.now()}@example.test`,
          password: 'Integration!Password1',
          emailVerifiedAt: new Date()
        },
        {
          name: 'Integration Other User',
          email: `integration-other-${Date.now()}@example.test`,
          password: 'Integration!Password1',
          emailVerifiedAt: new Date()
        }
      ]);
      createdUserIds.push(owner._id, otherUser._id);

      const accessTokenFor = user => jwt.sign(
        {},
        config.jwt.accessTokenSecret,
        { algorithm: 'HS256', subject: user._id.toString(), expiresIn: '5m' }
      );
      const ownerToken = accessTokenFor(owner);
      const otherUserToken = accessTokenFor(otherUser);

      const createImage = ({ format, width, height, color }) => sharp({
        create: { width, height, channels: 3, background: color }
      })[format]().toBuffer();

      const submitJob = async ({ image, filename, operation, options, accessToken }) => {
        let submission = request(app)
          .post(lifecyclePath)
          .field('operation', operation)
          .field('options', JSON.stringify(options))
          .attach('image', image, {
            filename,
            contentType: filename.endsWith('.jpg') ? 'image/jpeg' : 'image/png'
          });

        if (accessToken) submission = submission.set('Authorization', `Bearer ${accessToken}`);

        const response = await submission;
        assert.equal(response.status, 202, response.text);
        assert.equal(response.body.data.job.status, 'pending');
        createdJobIds.push(response.body.data.job.id);
        return response;
      };

      const guestResize = await submitJob({
        image: await createImage({
          format: 'jpeg', width: 160, height: 100, color: { r: 20, g: 80, b: 150 }
        }),
        filename: 'guest-resize.jpg',
        operation: 'resize',
        options: { width: 80, height: 50 }
      });
      const ownerCompress = await submitJob({
        image: await createImage({
          format: 'jpeg', width: 120, height: 90, color: { r: 170, g: 70, b: 30 }
        }),
        filename: 'owner-compress.jpg',
        operation: 'compress',
        options: { quality: 70 },
        accessToken: ownerToken
      });
      const ownerConvert = await submitJob({
        image: await createImage({
          format: 'png', width: 90, height: 60, color: { r: 30, g: 150, b: 80 }
        }),
        filename: 'owner-convert.png',
        operation: 'convert',
        options: { format: 'webp' },
        accessToken: ownerToken
      });
      const guestFailure = await submitJob({
        image: await createImage({
          format: 'jpeg', width: 40, height: 40, color: { r: 120, g: 20, b: 90 }
        }),
        filename: 'guest-failure.jpg',
        operation: 'compress',
        options: { quality: 70 }
      });

      const failureJob = await Job.findById(guestFailure.body.data.job.id);
      assert.ok(failureJob);
      failureJob.inputFile.secureUrl =
        `https://res.cloudinary.com/${config.cloudinary.cloudName}/image/upload/pixsolve/originals/integration-missing-${failureJob._id}.jpg`;
      await failureJob.save();

      // Creation has returned pending jobs before a worker is allowed to start.
      for (const id of createdJobIds) {
        const job = await Job.findById(id).lean();
        assert.equal(job.status, 'pending');
      }

      worker = spawn(process.execPath, ['src/bin/image-processing-worker.js'], {
        cwd: process.cwd(),
        env: { ...process.env, NODE_ENV: 'production', LOG_LEVEL: 'info' },
        stdio: ['ignore', 'pipe', 'pipe']
      });
      worker.stdout.on('data', chunk => { workerOutput += chunk.toString(); });
      worker.stderr.on('data', chunk => { workerOutput += chunk.toString(); });

      const terminalJobs = await waitFor(async () => {
        const jobs = await Job.find({ _id: { $in: createdJobIds } }).lean();
        return jobs.length === createdJobIds.length && jobs.every(job =>
          ['completed', 'failed'].includes(job.status)
        )
          ? jobs
          : null;
      });

      const byId = new Map(terminalJobs.map(job => [job._id.toString(), job]));
      const completedIds = [
        guestResize.body.data.job.id,
        ownerCompress.body.data.job.id,
        ownerConvert.body.data.job.id
      ];
      for (const id of completedIds) {
        const job = byId.get(id);
        assert.equal(job.status, 'completed');
        assert.ok(job.outputFile?.publicId);
        assert.ok(job.outputFile?.secureUrl);
        assert.equal(job.errorMessage, undefined);
      }

      const failedJob = byId.get(guestFailure.body.data.job.id);
      assert.equal(failedJob.status, 'failed');
      assert.equal(failedJob.outputFile, undefined);
      assert.equal(failedJob.errorMessage, 'Failed to download image');

      const guestResult = await request(app)
        .get(`${lifecyclePath}/${guestResize.body.data.job.id}`)
        .set('X-Guest-Access-Token', guestResize.body.data.guestAccessToken);
      assert.equal(guestResult.status, 200);
      assert.equal(guestResult.body.data.job.status, 'completed');

      const ownerResult = await request(app)
        .get(`${lifecyclePath}/${ownerCompress.body.data.job.id}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      assert.equal(ownerResult.status, 200);
      assert.equal(ownerResult.body.data.job.status, 'completed');

      const history = await request(app)
        .get(lifecyclePath)
        .set('Authorization', `Bearer ${ownerToken}`);
      assert.equal(history.status, 200);
      assert.deepEqual(
        new Set(history.body.data.jobs.map(job => job.id)),
        new Set([ownerCompress.body.data.job.id, ownerConvert.body.data.job.id])
      );

      const otherUserResult = await request(app)
        .get(`${lifecyclePath}/${ownerCompress.body.data.job.id}`)
        .set('Authorization', `Bearer ${otherUserToken}`);
      assert.equal(otherUserResult.status, 404);
      assert.equal(otherUserResult.body.code, 'JOB_NOT_FOUND');

      const accountWithGuestCredential = await request(app)
        .get(`${lifecyclePath}/${ownerCompress.body.data.job.id}`)
        .set('X-Guest-Access-Token', guestResize.body.data.guestAccessToken);
      assert.equal(accountWithGuestCredential.status, 404);
      assert.equal(accountWithGuestCredential.body.code, 'JOB_NOT_FOUND');

      const wrongGuestCredential = await request(app)
        .get(`${lifecyclePath}/${guestFailure.body.data.job.id}`)
        .set('X-Guest-Access-Token', guestResize.body.data.guestAccessToken);
      assert.equal(wrongGuestCredential.status, 404);
      assert.equal(wrongGuestCredential.body.code, 'JOB_NOT_FOUND');

      const failureResult = await request(app)
        .get(`${lifecyclePath}/${guestFailure.body.data.job.id}`)
        .set('X-Guest-Access-Token', guestFailure.body.data.guestAccessToken);
      assert.equal(failureResult.status, 200);
      assert.deepEqual(failureResult.body.data.job.error, {
        message: 'Failed to download image'
      });
      assert.equal(failureResult.body.data.job.result, undefined);

      const expectedMetadata = new Map([
        [guestResize.body.data.job.id, { width: 80, height: 50, format: 'jpeg' }],
        [ownerCompress.body.data.job.id, { width: 120, height: 90, format: 'jpeg' }],
        [ownerConvert.body.data.job.id, { width: 90, height: 60, format: 'webp' }]
      ]);
      for (const [id, expected] of expectedMetadata) {
        const output = byId.get(id).outputFile;
        const response = await fetch(output.secureUrl);
        assert.ok(response.ok, `Expected Cloudinary output to be accessible: ${id}`);
        const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
        assert.equal(metadata.width, expected.width);
        assert.equal(metadata.height, expected.height);
        assert.equal(metadata.format, expected.format);
      }

      await stopWorker();
      assert.match(workerOutput, /imageProcessingWorkerStarted/);
      assert.match(workerOutput, /imageProcessingCompleted/);
      assert.match(workerOutput, /imageProcessingFailed/);
      assert.equal(workerOutput.includes(guestResize.body.data.guestAccessToken), false);
      assert.equal(workerOutput.includes(guestFailure.body.data.guestAccessToken), false);
    } finally {
      await stopWorker();

      const jobs = databaseConnected && createdJobIds.length
        ? await Job.find({ _id: { $in: createdJobIds } }).lean()
        : [];
      const publicIds = jobs.flatMap(job => [
        job.inputFile?.publicId,
        job.outputFile?.publicId
      ].filter(Boolean));

      const cleanupResults = await Promise.allSettled([
        ...createdJobIds.map(id => imageProcessingQueue.getJob(`db-job-${id}`)
          .then(queueJob => queueJob?.remove())),
        ...publicIds.map(publicId => deleteImage(publicId)),
        databaseConnected && createdJobIds.length
          ? Job.deleteMany({ _id: { $in: createdJobIds } })
          : Promise.resolve(),
        databaseConnected && createdUserIds.length
          ? User.deleteMany({ _id: { $in: createdUserIds } })
          : Promise.resolve()
      ]);
      const cleanupFailure = cleanupResults.find(result => result.status === 'rejected');

      await shutdownImageProcessingQueue();
      await mongoose.disconnect();

      if (cleanupFailure) throw cleanupFailure.reason;
    }
  }
);
