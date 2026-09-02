import pino from 'pino';
import os from 'node:os';
import config from './env.js';

const logger = pino({
  // set min log level can be captured
  level: config.logLevel,

  // fields inside `base` are added to every log entry
  base: {
    pid: process.pid, // id of currently running Node.js process
    hostname: os.hostname(), // name of machine running the process
    app: 'pixsolve',
    env: config.nodeEnv,
  },

  // ISO timestamps instead of Unix timestamps
  // (1710000000000 to 2026-01-01T10:00:00.000Z)
  timestamp: pino.stdTimeFunctions.isoTime,

  // print output in pretty format of non production env
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