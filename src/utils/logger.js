const winston = require('winston');
const { format } = winston;
const DailyRotateFile = require('winston-daily-rotate-file');
const config = require('../config');

const logFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  format.errors({ stack: true }),
  format.splat(),
  format.printf(info => {
    return `${info.timestamp} [${info.level.toUpperCase()}] ${info.message}`;
  })
);

const transports = [
  new winston.transports.Console({
    level: 'debug',
    format: format.combine(
      format.colorize(),
      logFormat
    )
  }),
  new DailyRotateFile({
    filename: 'logs/application-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '30d',
    level: 'info',
    format: logFormat
  })
];

const logger = winston.createLogger({
  levels: winston.config.syslog.levels,
  transports,
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ]
});

// 处理未捕获的 Promise 异常
process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${reason.stack || reason}`);
});

module.exports = logger; 