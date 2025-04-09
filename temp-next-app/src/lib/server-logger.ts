/**
 * Server-side logging configuration module
 * 
 * This module configures the logger for server-side usage by reading
 * configuration from environment variables.
 * 
 * Environment variables:
 * - LOG_LEVEL: Global log level (ERROR, WARN, INFO, DEBUG)
 * - LOG_LEVEL_<COMPONENT>: Component-specific log level
 *   Example: LOG_LEVEL_CHATINTERFACE=DEBUG
 */

import { Logger, LogLevel, LogLevelString } from './logger';

// Convert string to LogLevel
function parseLogLevel(levelStr: string | undefined): LogLevel {
  if (!levelStr) return LogLevel.INFO; // Default to INFO level
  
  const level = levelStr.toUpperCase() as LogLevelString;
  switch (level) {
    case 'ERROR': return LogLevel.ERROR;
    case 'WARN': return LogLevel.WARN;
    case 'DEBUG': return LogLevel.DEBUG;
    case 'TRACE': return LogLevel.TRACE;
    case 'OFF': return LogLevel.OFF;
    case 'ALL': return LogLevel.ALL;
    case 'INFO':
    default:
      return LogLevel.INFO;
  }
}

/**
 * Initialize server-side logging configuration from environment variables
 */
export function initializeServerLogging(): void {
  // Get global log level from environment
  const globalLogLevel = parseLogLevel(process.env.LOG_LEVEL);
  
  // Set global log level
  Logger.setLogLevel(globalLogLevel);
  
  // Create a server logger instance
  const serverLogger = Logger.getLogger('Server');
  
  // Log the initialization
  serverLogger.info('Server logging initialized', {
    globalLevel: globalLogLevel,
    nodeEnv: process.env.NODE_ENV
  });
  
  // Process all LOG_LEVEL_* environment variables for component-specific logging
  Object.entries(process.env).forEach(([key, value]) => {
    if (key.startsWith('LOG_LEVEL_') && value) {
      const componentName = key.replace('LOG_LEVEL_', '').toLowerCase();
      // We don't have component-specific levels in the updated Logger,
      // but we can enable/disable specific loggers
      Logger.enableLogger(componentName, true);
    }
  });
}