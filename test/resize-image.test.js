import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { ZodError } from 'zod';
import resizeImage from '../src/image-processing/resize-image.js';

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

  // `toBuffer()` return a promise so we will wait `createImage`
  return sharp(config)[format]().toBuffer();
};

for (const format of formats) {
  test(`resizes a valid ${format.toUpperCase()} image`, async () => {
    const inputBuffer = await createImage(format);
    const outputBuffer = await resizeImage(inputBuffer, { width: 100, height: 100 });

    const metadata = await sharp(outputBuffer).metadata();

    assert.equal(metadata.width, 100);
    assert.equal(metadata.height, 100);
    assert.equal(metadata.format, format);
  });
}

const invalidOptions = [
  {
    name: 'zero width',
    options: { width: 0, height: 100 }
  },
  {
    name: 'negative height',
    options: { width: 100, height: -1 }
  },
  {
    name: 'fractional width',
    options: { width: 10.5, height: 100 }
  },
  {
    name: 'string width',
    options: { width: '100', height: 100 }
  },
  {
    name: 'missing height',
    options: { width: 100 }
  },
  {
    name: 'user-selected fit',
    options: { width: 100, height: 100, fit: 'inside' }
  }
];

for (const invalidCase of invalidOptions) {
  test(`rejects ${invalidCase.name} before image processing`, async () => {
    await assert.rejects(
      resizeImage(Buffer.from('not an image'), invalidCase.options),
      error => error instanceof ZodError
    );
  });
}