// utils/logger.js
import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';

const ensureLogsDirectoryExists = () => {
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
  }
};

const logToFile = (message) => {
  const currentDate = dayjs().format('YYYY-MM-DD');
  const logFilePath = path.join(process.cwd(), 'logs', `app_${currentDate}.log`);
  fs.appendFileSync(logFilePath, `${dayjs().toISOString()} - ${message}\n`);
};

const logger = {
  init: () => ensureLogsDirectoryExists(),
  info: (message) => logToFile(`INFO: ${message}`),
  error: (error, message) => logToFile(`ERROR: ${message} - ${error.message}`),
};

export default logger;
