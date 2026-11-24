import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import User from '../models/User.js';
import { AppError, asyncHandler } from './errorMiddleware.js';

export const protect = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    throw new AppError('Authentication required: missing Bearer token', 401);
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new AppError('Authentication required: empty token', 401);
  }

  const decoded = jwt.verify(token, env.jwtAccessSecret);
  const user = await User.findById(decoded.id).select('-password -refreshTokenHash');

  if (!user) {
    throw new AppError('User belonging to this token no longer exists', 401);
  }

  req.user = user;
  next();
});
