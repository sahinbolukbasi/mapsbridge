/**
 * Standard Domain and Application Exceptions
 * Clean Architecture & DDD Invariants
 */

export class DomainException extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code = "DOMAIN_ERROR", statusCode = 400) {
    super(message);
    this.name = "DomainException";
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationException extends DomainException {
  public readonly validationErrors?: Record<string, string[]>;

  constructor(message: string, validationErrors?: Record<string, string[]>) {
    super(message, "VALIDATION_FAILED", 400);
    this.name = "ValidationException";
    this.validationErrors = validationErrors;
  }
}

export class NotFoundException extends DomainException {
  constructor(entityName: string, identifier?: string | number) {
    const msg = identifier ? `${entityName} with id '${identifier}' not found.` : `${entityName} not found.`;
    super(msg, "NOT_FOUND", 404);
    this.name = "NotFoundException";
  }
}

export class UnauthorizedException extends DomainException {
  constructor(message = "Unauthorized access.") {
    super(message, "UNAUTHORIZED", 401);
    this.name = "UnauthorizedException";
  }
}

export class ForbiddenException extends DomainException {
  constructor(message = "Forbidden access.") {
    super(message, "FORBIDDEN", 403);
    this.name = "ForbiddenException";
  }
}

export class DomainValidationError extends DomainException {
  constructor(message: string) {
    super(message, "DOMAIN_VALIDATION_ERROR", 400);
    this.name = "DomainValidationError";
  }
}

export class InsufficientCreditsException extends DomainException {
  constructor(required: number, available: number) {
    super(
      `Insufficient credits. Required: ${required}, available: ${available}.`,
      "INSUFFICIENT_CREDITS",
      402
    );
    this.name = "InsufficientCreditsException";
  }
}
