export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

import { browserAPI } from './browser-api';

const isProduction = !browserAPI.getManifest().version.includes('-dev');

export const createLogger = function(context: string): Logger {
  const logWithLevel = (level: LogLevel) => 
    (message: string, ...args: unknown[]) => {
      if (isProduction && level === 'debug') return;
      
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [${level.toUpperCase()}] [${context}]`;
      
      // eslint-disable-next-line no-console
      console[level](`${prefix} ${message}`, ...args);
    };

  return {
    debug: logWithLevel('debug'),
    info: logWithLevel('info'),
    warn: logWithLevel('warn'),
    error: logWithLevel('error')
  };
}