import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import request from 'supertest';
import errorHandler from '../src/middleware/errorHandler.js';
import uploadSingleImage from '../src/middleware/image-upload.js';
import validate from '../src/middleware/validate.js';
import {
  jobOperationRequestSchema,
  MAX_RESIZE_DIMENSION
} from '../src/validations/job-operations.js';

const createTestApp = () => {
  const app = express();

  app.post(
    '/jobs',
    uploadSingleImage,
    validate(jobOperationRequestSchema),
    (req, res) => res.status(200).json(req.validated.body)
  );

  app.use(errorHandler);

  return app;
};

const sendOperationRequest = ({ operation, options, rawOptions }) => {
  let pendingRequest = request(createTestApp()).post('/jobs');

  if (operation !== undefined) {
    pendingRequest = pendingRequest.field('operation', operation);
  }

  if (rawOptions !== undefined) {
    pendingRequest = pendingRequest.field('options', rawOptions);
  } else if (options !== undefined) {
    pendingRequest = pendingRequest.field('options', JSON.stringify(options));
  }

  return pendingRequest;
};

const assertValidationError = (response, expectedFieldPrefix) => {
  assert.equal(response.status, 422);
  assert.equal(response.body.status, 'error');
  assert.equal(response.body.code, 'VALIDATION_ERROR');
  assert.equal(response.body.message, 'Validation Error');
  assert.ok(Array.isArray(response.body.details.fields));

  assert.ok(
    response.body.details.fields.some(validationError => {
      if (validationError.source !== 'body') return false;

      return validationError.field === expectedFieldPrefix
        || validationError.field?.startsWith(`${expectedFieldPrefix}.`);
    })
  );
};

const validCases = [
  {
    name: 'resize with boundary dimensions',
    operation: 'resize',
    options: { width: 1, height: MAX_RESIZE_DIMENSION }
  },
  {
    name: 'compress at minimum quality',
    operation: 'compress',
    options: { quality: 1 }
  },
  {
    name: 'compress at maximum quality',
    operation: 'compress',
    options: { quality: 100 }
  },
  ...['jpeg', 'png', 'webp'].map(format => ({
    name: `convert to ${format}`,
    operation: 'convert',
    options: { format }
  }))
];

for (const validCase of validCases) {
  test(`accepts ${validCase.name} and exposes normalized data`, async () => {
    const response = await sendOperationRequest(validCase);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      operation: validCase.operation,
      options: validCase.options
    });
  });
}

const invalidCases = [
  {
    name: 'an unsupported operation',
    operation: 'rotate',
    options: { angle: 90 },
    expectedField: 'operation'
  },
  {
    name: 'a missing operation',
    options: { width: 800, height: 600 },
    expectedField: 'operation'
  },
  {
    name: 'missing options',
    operation: 'resize',
    expectedField: 'options'
  },
  {
    name: 'malformed options JSON',
    operation: 'resize',
    rawOptions: '{"width":800',
    expectedField: 'options'
  },
  {
    name: 'resize options missing height',
    operation: 'resize',
    options: { width: 800 },
    expectedField: 'options'
  },
  {
    name: 'a zero resize dimension',
    operation: 'resize',
    options: { width: 0, height: 600 },
    expectedField: 'options'
  },
  {
    name: 'a resize dimension above the maximum',
    operation: 'resize',
    options: { width: MAX_RESIZE_DIMENSION + 1, height: 600 },
    expectedField: 'options'
  },
  {
    name: 'a fractional resize dimension',
    operation: 'resize',
    options: { width: 800.5, height: 600 },
    expectedField: 'options'
  },
  {
    name: 'a string resize dimension',
    operation: 'resize',
    options: { width: '800', height: 600 },
    expectedField: 'options'
  },
  {
    name: 'quality below one',
    operation: 'compress',
    options: { quality: 0 },
    expectedField: 'options'
  },
  {
    name: 'quality above one hundred',
    operation: 'compress',
    options: { quality: 101 },
    expectedField: 'options'
  },
  {
    name: 'fractional quality',
    operation: 'compress',
    options: { quality: 70.5 },
    expectedField: 'options'
  },
  {
    name: 'an unsupported conversion format',
    operation: 'convert',
    options: { format: 'gif' },
    expectedField: 'options'
  },
  {
    name: 'resize with compression options',
    operation: 'resize',
    options: { quality: 70 },
    expectedField: 'options'
  },
  {
    name: 'compress with conversion options',
    operation: 'compress',
    options: { format: 'webp' },
    expectedField: 'options'
  },
  {
    name: 'convert with resize options',
    operation: 'convert',
    options: { width: 800, height: 600 },
    expectedField: 'options'
  },
  {
    name: 'an extra operation option',
    operation: 'convert',
    options: { format: 'webp', quality: 70 },
    expectedField: 'options'
  }
];

for (const invalidCase of invalidCases) {
  test(`rejects ${invalidCase.name}`, async () => {
    const response = await sendOperationRequest(invalidCase);

    assertValidationError(response, invalidCase.expectedField);
  });
}
