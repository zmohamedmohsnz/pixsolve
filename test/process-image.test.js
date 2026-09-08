import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import processImage from '../src/image-processing/process-image.js';

const operations = ['resize', 'compress', 'convert'];

const operationCases = {
  resize: {
    options: { width: 100, height: 100 },
    expected: { width: 100, height: 100, format: 'jpeg' }
  },

  compress: {
    options: { quality: 70 },
    expected: { width: 400, height: 200, format: 'jpeg' }
  },

  convert: {
    options: { format: 'webp' },
    expected: { width: 400, height: 200, format: 'webp' }
  }
};

const createImage = format => {
  const config = {
    create: {
      width: 400,
      height: 200,
      channels: 3,
      background: { r: 40, g: 120, b: 200 }
    }
  };

  return sharp(config)[format]().toBuffer();
};

for (const operation of operations) {
  test(`dispatches a ${operation} operation and returns the processed buffer`, async () => {
    const inputImgBuffer = await createImage('jpeg');

    const outputImgBuffer = await processImage(
      inputImgBuffer,
      operation,
      operationCases[operation].options
    );

    const metadata = await sharp(outputImgBuffer).metadata();

    assert.ok(Buffer.isBuffer(outputImgBuffer));
    assert.equal(metadata.width, operationCases[operation].expected.width);
    assert.equal(metadata.height, operationCases[operation].expected.height);
    assert.equal(metadata.format, operationCases[operation].expected.format);
  });
}

test('rejects an unsupported operation clearly', async () => {
  await assert.rejects(
    processImage(Buffer.from('not an image'), 'rotate', {}),
    {
      name: 'Error',
      message: 'Unsupported image operation: rotate'
    }
  );
});