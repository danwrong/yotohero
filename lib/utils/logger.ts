// Production-ready logging utility
interface LogContext {
  [key: string]: any;
}

interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: LogContext;
  timestamp: string;
  service: string;
}

class Logger {
  private service: string;

  constructor(service: string) {
    this.service = service;
  }

  private log(level: LogEntry['level'], message: string, context?: LogContext): void {
    const entry: LogEntry = {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
      service: this.service
    };

    // In development, use console with better formatting
    if (process.env.NODE_ENV === 'development') {
      const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
      const levelEmoji = {
        debug: '🐛',
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌'
      };
      
      console[level === 'debug' ? 'debug' : level === 'warn' ? 'warn' : level === 'error' ? 'error' : 'log'](
        `${levelEmoji[level]} [${this.service}] ${message}${contextStr}`
      );
    } else {
      // In production, output structured JSON for log aggregation
      console.log(JSON.stringify(entry));
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }
}

// Factory function to create service-specific loggers
export function createLogger(service: string): Logger {
  return new Logger(service);
}

// Pre-configured loggers for common services
export const apiLogger = createLogger('api');
export const yotoLogger = createLogger('yoto');
export const ttsLogger = createLogger('elevenlabs');
export const safetyLogger = createLogger('safety');