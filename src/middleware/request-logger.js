import { randomUUID } from 'node:crypto';
import pinoHttp from 'pino-http';
import logger from '../config/logger.js';

const requestLogger = pinoHttp({
  // reuse the config of the app logger
  logger,

  // generate an ID for every request so
  // we can group logs of a request easily. 
  genReqId: (_req, res) => {
    const reqId = randomUUID();

    // send ID in responses so clients can use it in bug reports
    res.setHeader('X-Request-Id', reqId);

    return reqId;
  },

  customLogLevel: (_req, res, err) => {
    // - set the log level based on status code.
    // - use `res.err` to catch errors happen after a response starts
    //  as status code will be `200` while `res.err` contains an error.
    // - use `err` to catch errors happen while completing the underlying response.

    if (res.statusCode >= 500 || res.err || err) return 'error';
    if (res.statusCode >=400) return 'warn';

    return 'info';
  },

  // default log serializer contains unnecessary and may sensitive info
  // so we use a custom one to provide only what we want.
  serializers: {
    req: (req) => ({
      method: req.method,

      // `split()` to exclude query string
      // that may contain sensitive input.
      path: req.raw?.path ?? req.url?.split('?')[0],

      ip: req.raw?.ip ?? req.remoteAddress,
      userAgent: req.headers?.['user-agent'],
    }),

    res: (res) => ({ status: res.statusCode }),

    // `pino-http` internally fetches `res.err` and passes it
    // to its default error serializer. without `res.err`, pino
    // serializes generic error when sees that status is `500`.
  },

  // logs created using `req.log` include all serialized info
  // you set. this means five logs will repeat method, ip, userAgent,
  // and so on. this info already assigned to the automatic request log.
  // so with this field, req ID is only what added to every `req.log`. 
  quietReqLogger: true,

  customErrorMessage: () => 'Request failed',
  customSuccessMessage: (_req, res) => {
    if (res.statusCode >= 400) return 'Request rejected';
    return 'Request completed';
  },
});

export default requestLogger;