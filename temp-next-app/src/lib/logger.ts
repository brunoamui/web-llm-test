/**
 * Unified logging system with log levels and selective logging
 * 
 * Usage examples:
 * 
 * import { Logger, LogLevel } from '@/lib/logger';
 * 
 * // Create a logger for a specific component
 * const logger = Logger.getLogger('ChatInterface');
 * 
 * // Log at different levels
 * logger.error('Failed to load model', error);
 * logger.warn('API rate limit approaching');
 * logger.info('Model loaded successfully');
 * logger.debug('Processing message', { message });
 * logger.trace('Function entry', { args });
 * 
 * // Log an object
 * logger.info('Engine state', { engine });
 */

// Enum-style LogLevel for numeric representation
export enum LogLevel {
  OFF = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  TRACE = 5,
  ALL = 6
}

// String representation of log levels
export type LogLevelString = 'OFF' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE' | 'ALL';

// Interface for logger options
export interface LoggerOptions {
  name?: string;
  minLevel?: LogLevel;
  enabled?: boolean;
  componentLevels?: Record<string, LogLevel>;
}

// Logger class with proper typing
export class Logger {
  private static logLevel: LogLevel = LogLevel.INFO;
  private static enabledLoggers: Record<string, boolean> = {};
  private static componentLevels: Record<string, LogLevel> = {};
  private name: string;
  private enabled: boolean;

  private constructor(name: string, enabled = true) {
    this.name = name;
    this.enabled = enabled;
  }

  // Get a named logger instance
  static getLogger(name: string, options: Partial<LoggerOptions> = {}): Logger {
    const logger = new Logger(
      name, 
      options.enabled !== undefined ? options.enabled : true
    );
    
    // Register in enabled loggers map for global control
    Logger.enabledLoggers[name] = logger.enabled;
    
    return logger;
  }

  // Configure the logger system
  static configure(config: { 
    minLevel?: LogLevel; 
    componentLevels?: Record<string, LogLevel>;
    enabled?: boolean;
  }): void {
    if (config.minLevel !== undefined) {
      Logger.logLevel = config.minLevel;
    }
    
    if (config.componentLevels) {
      Logger.componentLevels = {...config.componentLevels};
    }
    
    if (config.enabled !== undefined) {
      // Set all loggers to this enabled state
      Object.keys(Logger.enabledLoggers).forEach(name => {
        Logger.enabledLoggers[name] = config.enabled!;
      });
    }
  }

  // Set global log level - accepts only numeric LogLevel enum
  static setLogLevel(level: LogLevel): void {
    // Ensure the level is a valid enum value
    if (level >= LogLevel.OFF && level <= LogLevel.ALL) {
      Logger.logLevel = level;
    } else {
      console.warn(`Invalid log level provided: ${level}. Defaulting to INFO.`);
      Logger.logLevel = LogLevel.INFO;
    }
  }

  // Enable/disable specific logger
  static enableLogger(name: string, enabled = true): void {
    Logger.enabledLoggers[name] = enabled;
  }

  // Debug level logging
  debug(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(`[DEBUG][${this.name}] ${message}`, context !== undefined ? context : '');
    }
  }

  // Info level logging
  info(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(`[INFO][${this.name}] ${message}`, context !== undefined ? context : '');
    }
  }

  // Warning level logging
  warn(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(`[WARN][${this.name}] ${message}`, context !== undefined ? context : '');
    }
  }

  // Error level logging
  error(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(`[ERROR][${this.name}] ${message}`, context !== undefined ? context : '');
    }
  }
  
  // Trace level logging (most detailed)
  trace(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog(LogLevel.TRACE)) {
      console.debug(`[TRACE][${this.name}] ${message}`, context !== undefined ? context : '');
    }
  }

  // Check if this message should be logged based on level and enabled status
  private shouldLog(level: LogLevel): boolean {
    // Skip if logger is disabled
    if (!this.enabled || Logger.enabledLoggers[this.name] === false) {
      return false;
    }

    // Check if component has specific level
    if (this.name in Logger.componentLevels) {
      return level <= Logger.componentLevels[this.name];
    }

    // Otherwise use global level
    return level <= Logger.logLevel;
  }
}