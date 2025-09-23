// Logging utilities for the RepoCloner server
export interface LogMessage {
  level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR';
  message: string;
  timestamp: Date;
}

let logCallback: ((message: LogMessage) => void) | null = null;

export function setLogCallback(callback: (message: LogMessage) => void) {
  logCallback = callback;
}

export function broadcastLog(level: LogMessage['level'], message: string) {
  const logMessage: LogMessage = { level, message, timestamp: new Date() };
  if (logCallback) {
    logCallback(logMessage);
  }
  console.log(`${logMessage.timestamp.toISOString()} [${level}] ${message}`);
}