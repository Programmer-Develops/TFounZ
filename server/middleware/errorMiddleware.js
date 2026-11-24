export class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function notFound(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

export function errorHandler(err, req, res, _next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let details = err.details || null;

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const errors = Object.values(err.errors || {}).map((e) => e.message);
    message = errors[0] || 'Validation failed';
    details = errors;
  }

  // Mongoose invalid ObjectId cast error
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    statusCode = 409;
    const fields = Object.keys(err.keyPattern || err.keyValue || {});
    message = fields.length
      ? `${fields.join(', ')} already exists`
      : 'Duplicate resource value';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    message =
      err.name === 'TokenExpiredError'
        ? 'Access token expired'
        : 'Invalid authentication token';
  }

  // Multer upload errors
  if (err.name === 'MulterError') {
    statusCode = 400;
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Uploaded file exceeds the 80 MB studio limit'
        : `File upload error: ${err.message}`;
  }

  // Redact any accidental API key query params
  const safeMessage = String(message).replace(/([?&]key=)[^&\s"']+/gi, '$1[REDACTED]');

  if (statusCode >= 500) {
    console.error(`[ERROR ${statusCode}] ${req.method} ${req.originalUrl}:`, safeMessage);
  }

  res.status(statusCode).json({
    status: 'error',
    message: safeMessage,
    ...(details ? { details } : {}),
  });
}
