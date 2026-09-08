import resizeImage from './resize-image.js';
import compressImage from './compress-image.js';
import convertImage from './convert-image.js';

// if we used a normal object, not a map, names inherited
// from `Object.prototype` will be treated as processors.
// so if someone passed `toString` as operation name, it
// will pass, but it should be rejected, so we use map.
const operations = new Map([
  ['resize', resizeImage],
  ['compress', compressImage],
  ['convert', convertImage]
]);

// this is a dispatcher that look at the requested operation
// and send the image to the correct processor
const dispatchImageOperation = async (inputImage, operation, options) => {
  const processor = operations.get(operation);

  if (!processor)
    throw new Error(`Unsupported image operation: ${operation}`);

  return processor(inputImage, options);
};

export default dispatchImageOperation;