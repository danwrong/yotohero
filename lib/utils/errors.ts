// Standardized error classes for the application

export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly isOperational: boolean;
  abstract readonly userMessage: string;
  
  constructor(message: string, public readonly context?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
  }
}

// API-related errors
export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly isOperational = true;
  readonly userMessage: string;

  constructor(message: string, context?: Record<string, any>) {
    super(message, context);
    this.userMessage = message; // Validation errors are safe to show users
  }
}

export class AuthenticationError extends AppError {
  readonly statusCode = 401;
  readonly isOperational = true;
  readonly userMessage = 'Authentication required. Please log in with your Yoto account.';

  constructor(message: string = 'Authentication failed', context?: Record<string, any>) {
    super(message, context);
  }
}

export class AuthorizationError extends AppError {
  readonly statusCode = 403;
  readonly isOperational = true;
  readonly userMessage = 'You do not have permission to perform this action.';

  constructor(message: string = 'Authorization failed', context?: Record<string, any>) {
    super(message, context);
  }
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly isOperational = true;
  readonly userMessage = 'The requested resource was not found.';

  constructor(message: string = 'Resource not found', context?: Record<string, any>) {
    super(message, context);
  }
}

export class RateLimitError extends AppError {
  readonly statusCode = 429;
  readonly isOperational = true;
  readonly userMessage = 'Too many requests. Please try again later.';

  constructor(message: string = 'Rate limit exceeded', context?: Record<string, any>) {
    super(message, context);
  }
}

// External service errors
export class ExternalServiceError extends AppError {
  readonly statusCode = 502;
  readonly isOperational = true;
  readonly userMessage = 'External service temporarily unavailable. Please try again.';

  constructor(
    public readonly service: string,
    message: string,
    context?: Record<string, any>
  ) {
    super(`${service}: ${message}`, context);
  }
}

export class YotoAPIError extends ExternalServiceError {
  constructor(message: string, context?: Record<string, any>) {
    super('Yoto API', message, context);
  }
}

export class ElevenLabsError extends ExternalServiceError {
  constructor(message: string, context?: Record<string, any>) {
    super('ElevenLabs', message, context);
  }
}

export class OpenAIError extends ExternalServiceError {
  constructor(message: string, context?: Record<string, any>) {
    super('OpenAI', message, context);
  }
}

// Content safety errors
export class ContentSafetyError extends AppError {
  readonly statusCode = 400;
  readonly isOperational = true;
  readonly userMessage: string;

  constructor(
    message: string,
    public readonly issues: string[],
    context?: Record<string, any>
  ) {
    super(message, context);
    this.userMessage = `Content safety check failed: ${issues.join(', ')}`;
  }
}

// Configuration errors
export class ConfigurationError extends AppError {
  readonly statusCode = 500;
  readonly isOperational = false;
  readonly userMessage = 'Service temporarily unavailable due to configuration issues.';

  constructor(message: string, context?: Record<string, any>) {
    super(message, context);
  }
}

// Generic server errors
export class InternalServerError extends AppError {
  readonly statusCode = 500;
  readonly isOperational = false;
  readonly userMessage = 'An unexpected error occurred. Please try again.';

  constructor(message: string = 'Internal server error', context?: Record<string, any>) {
    super(message, context);
  }
}

// Utility function to determine if an error is an AppError
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

// Utility function to convert unknown errors to AppError
export function normalizeError(error: unknown, defaultMessage: string = 'Unknown error occurred'): AppError {
  if (isAppError(error)) {
    return error;
  }
  
  if (error instanceof Error) {
    return new InternalServerError(error.message);
  }
  
  return new InternalServerError(defaultMessage);
}