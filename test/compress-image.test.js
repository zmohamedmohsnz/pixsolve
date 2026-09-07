import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { ZodError } from 'zod';
import compressImage from '../src/image-processing/compress-image.js';

const formats = ['jpeg', 'png', 'webp'];

const createImage = format => {
  // set the image properties
  const config = {
    create: {
      width: 400,
      height: 200,
      channels: 3,
      background: { r: 40, g: 120, b: 200 }
    }
  };

  // create the image and specify the format
  return sharp(config)[format]().toBuffer();
};

for (const format of formats) {
  test(`compresses a valid ${format.toUpperCase()} image`, async () => {
    const inputImage = await createImage(format);
    const outputImage = await compressImage(inputImage, { quality: 70 });

    const metadata = await sharp(outputImage).metadata();

    assert.equal(metadata.format, format);
    assert.equal(metadata.width, 400);
    assert.equal(metadata.height, 200);
  });
}

const invalidCases = [
  {
    name: 'zero quality',
    options: { quality: 0 }
  },
  {
    name: 'quality above 100',
    options: { quality: 101 }
  },
  {
    name: 'fractional quality',
    options: { quality: 70.5 }
  },
  {
    name: 'string quality',
    options: { quality: '70' }
  },
  {
    name: 'missing quality',
    options: {}
  },
  {
    name: 'format-specific option',
    options: { quality: 70, lossless: true }
  }
];

for (const invalidCase of invalidCases) {
  test(`rejects ${invalidCase.name} before image processing`, async () => {
    await assert.rejects(
      compressImage(Buffer.from('not an image'), invalidCase.options),
      error => error instanceof ZodError
    );
  });
}