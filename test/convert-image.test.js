import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { ZodError } from 'zod';
import convertImage from '../src/image-processing/convert-image.js';

const formats = ['jpeg', 'png', 'webp'];

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

for (const inputFormat of formats ) {
  for (const outputFormat of formats) {
    test(
      `converts a valid ${inputFormat.toUpperCase()} image to ${outputFormat.toUpperCase()}`,
      async () => {
        const inputImage = await createImage(inputFormat);
        const outputImage = await convertImage(inputImage, { format: outputFormat });

        const metadata = await sharp(outputImage).metadata();

        assert.ok(Buffer.isBuffer(outputImage));
        assert.equal(metadata.format, outputFormat);
        assert.equal(metadata.width, 400);
        assert.equal(metadata.height, 200);
      }
    );
  }
}

const invalidCases = [
  {
    name: 'unsupported GIF format',
    options: { format: 'gif' }
  },
  {
    name: 'unsupported JPG alias',
    options: { format: 'jpg' }
  },
  {
    name: 'uppercase format',
    options: { format: 'JPEG' }
  },
  {
    name: 'missing format',
    options: {}
  },
  {
    name: 'format-specific quality option',
    options: { format: 'jpeg', quality: 70 }
  }
];

for (const invalidCase of invalidCases) {
  test(`rejects ${invalidCase.name} before image processing`, async () => {
    await assert.rejects(
      convertImage(Buffer.from(`not an image`), invalidCase.options),
      error => error instanceof ZodError
    );
  });
}