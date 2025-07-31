// logger.js
const fs = require('fs');
const path = require('path');

// Get the current date as a string (e.g., "2025-07-30")
const getCurrentDateString = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Adding leading zero if needed
  const day = String(date.getDate()).padStart(2, '0'); // Adding leading zero if needed
  return `${year}-${month}-${day}`;
};

// Function to create the logs directory if it doesn't exist
const ensureLogsDirectoryExists = () => {
  const logsDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
  }
};

// Logger function to write messages to a log file
const logToFile = (message) => {
  // Ensure the logs directory exists
  ensureLogsDirectoryExists();

  // Get the current date string to use in the log file name
  const currentDate = getCurrentDateString();

  // Define the log file path (logs/app_<date>.log)
  const logFilePath = path.join(__dirname, 'logs', `app_${currentDate}.log`);

  // Write the message to the log file with a timestamp
  fs.appendFileSync(logFilePath, `${new Date().toISOString()} - ${message}\n`);
};

module.exports = {
  info: (message) => logToFile(`INFO: ${message}`),
  error: (message) => logToFile(`ERROR: ${message}`)
};
