import pino from 'pino';
import os from 'node:os';
import config from './env.js';

const logger = pino({
  // set minimum log level can be recorded.
  // Any level below it, will be ignored.
  level: config.logLevel,

  // fields inside `base` are added to every log.
  base: {
    pid: process.pid,
    hostname: os.hostname(),
    app: 'pixsolve',
    env: config.nodeEnv,
  },

  // ISO timestamp instead of Unix timestamp
  // (2026-01-01T10:00:00.000Z instead of 1710000000000)
  timestamp: pino.stdTimeFunctions.isoTime,

  // print logs in pretty format in non production env
  ...(config.nodeEnv !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      }
    }
  })
});

export default logger;