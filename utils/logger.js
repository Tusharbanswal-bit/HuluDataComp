import { Logger } from 'errorlogger';

const loggerConfig = {
  logging: {
    stdout: true,
    customLevels: { clienterror: 70 },
    showErrorsInMainStream: ['info', 'warn', 'debug'],
    max_logs: '14d',
    logLevel: 'info',
    logStreams: [
      {
        stream: 'main',
        filename: './logs/DataComparer-%DATE%',
        logLevel: 'info'
      },
      {
        stream: 'error',
        filename: './logs/DataComparer-%DATE%-error',
        logLevel: 'error'
      }
    ],
  }
}

export default new Logger(loggerConfig);
