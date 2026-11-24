import { AppError } from './errorMiddleware.js';

export function authorizeRoles(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Access denied: role '${req.user.role}' requires one of [${allowedRoles.join(', ')}]`,
          403
        )
      );
    }
    return next();
  };
}
