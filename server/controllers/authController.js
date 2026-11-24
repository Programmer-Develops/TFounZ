import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import User from '../models/User.js';
import { AppError, asyncHandler } from '../middleware/errorMiddleware.js';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signTokens(user) {
  const payload = { id: user._id.toString(), role: user.role };
  const accessToken = jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpires,
  });
  const refreshToken = jwt.sign({ id: user._id.toString() }, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpires,
  });
  return { accessToken, refreshToken };
}

function serializeUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarColor: user.avatarColor,
    bio: user.bio,
    createdAt: user.createdAt,
  };
}

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, bio } = req.body;
  if (!name || !email || !password) {
    throw new AppError('Name, email, and password are required', 400);
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    throw new AppError('An account with this email already exists', 409);
  }

  // Only allow host or participant self-registration; admin must be promoted/seeded
  const safeRole = role === 'participant' ? 'participant' : 'host';
  const palette = ['#f5b041', '#ff4d6d', '#38bdf8', '#2ee59d', '#a855f7'];
  const avatarColor = palette[Math.floor(Math.random() * palette.length)];

  const user = new User({
    name,
    email: normalizedEmail,
    password,
    role: safeRole,
    avatarColor,
    bio: bio || '',
  });

  const { accessToken, refreshToken } = signTokens(user);
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save();

  res.status(201).json({
    status: 'success',
    message: 'Account registered successfully',
    data: {
      user: serializeUser(user),
      accessToken,
      refreshToken,
    },
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new AppError('Email and password are required', 400);
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail }).select(
    '+password +refreshTokenHash'
  );

  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid email or password', 401);
  }

  const { accessToken, refreshToken } = signTokens(user);
  user.refreshTokenHash = hashToken(refreshToken);
  await user.save({ validateBeforeSave: false });

  res.json({
    status: 'success',
    message: 'Logged in successfully',
    data: {
      user: serializeUser(user),
      accessToken,
      refreshToken,
    },
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    throw new AppError('Refresh token is required', 400);
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, env.jwtRefreshSecret);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const user = await User.findById(decoded.id).select('+refreshTokenHash');
  if (!user || !user.refreshTokenHash) {
    throw new AppError('Session no longer active, please log in again', 401);
  }

  const incomingHash = hashToken(refreshToken);
  if (incomingHash !== user.refreshTokenHash) {
    user.refreshTokenHash = null;
    await user.save({ validateBeforeSave: false });
    throw new AppError('Refresh token reuse detected; please log in again', 401);
  }

  const tokens = signTokens(user);
  user.refreshTokenHash = hashToken(tokens.refreshToken);
  await user.save({ validateBeforeSave: false });

  res.json({
    status: 'success',
    message: 'Token refreshed',
    data: {
      user: serializeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    },
  });
});

export const logout = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { refreshTokenHash: null });
  res.json({
    status: 'success',
    message: 'Logged out successfully',
  });
});

export const getMe = asyncHandler(async (req, res) => {
  res.json({
    status: 'success',
    data: { user: serializeUser(req.user) },
  });
});
