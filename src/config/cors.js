import config from '../config/env.js';

const corsOptions = {
  origin: config.allowedOrigins,
};

export default corsOptions;