/**
 * Server-side logging configuration module
 * 
 * This module configures the logger for server-side usage by reading
 * configuration from environment variables.
 * 
 * Environment variables:
 * - LOG_LEVEL: Global log level (ERROR, WARN, INFO, DEBUG, TRACE)
 * - LOG_LEVEL_<COMPONENT>: Component-specific log level
 *   Example: LOG_LEVEL_CHATINTERFACE=DEBUG
 */

import { Logger, LogLevel } from './logger';

// Convert string to LogLevel enum
function parseLogLevel(levelStr: string | undefined): LogLevel {
  if (!levelStr) return LogLevel.INFO; // Default to INFO level
  
  const levels: Record<string, LogLevel> = {
    'OFF': LogLevel.OFF,
    'ERROR': LogLevel.ERROR,
    'WARN': LogLevel.WARN,
    'INFO': LogLevel.INFO,
    'DEBUG': LogLevel.DEBUG,
    'TRACE': LogLevel.TRACE,
    'ALL': LogLevel.ALL
  };
  
  return levels[levelStr.toUpperCase()] || LogLevel.INFO;
}

/**
 * Initialize server-side logging configuration from environment variables
 */
export function initializeServerLogging(): void {
  // Get global log level from environment
  const globalLogLevel = parseLogLevel(process.env.LOG_LEVEL);
  
  // Component-specific log levels from environment variables
  const componentLevels: Record<string, LogLevel> = {};
  
  // Process all LOG_LEVEL_* environment variables
  Object.entries(process.env).forEach(([key, value]) => {
    if (key.startsWith('LOG_LEVEL_') && value) {
      const componentName = key.replace('LOG_LEVEL_', '');
      componentLevels[componentName] = parseLogLevel(value);
    }
  });
  
  // Configure the logger
  Logger.configure({
    minLevel: globalLogLevel,
    componentLevels,
    enabled: process.env.NODE_ENV !== 'test' // Disable logging in test environment
  });
  
  // Create a server logger instance
  const serverLogger = Logger.getLogger('Server');
  
  // Log the initialization
  serverLogger.info('Server logging initialized', {
    globalLevel: LogLevel[globalLogLevel],
    componentLevels: Object.entries(componentLevels).reduce((acc, [key, val]) => {
      acc[key] = LogLevel[val];
      return acc;
    }, {} as Record<string, string>),
    nodeEnv: process.env.NODE_ENV
  });
}