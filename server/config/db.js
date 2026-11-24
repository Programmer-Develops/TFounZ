import mongoose from 'mongoose';
import env from './env.js';

/**
 * Connect to MongoDB Atlas (or local MongoDB) via Mongoose.
 */
export async function connectDB() {
  if (!env.mongoUri) {
    throw new Error(
      'MONGO_URI is not defined. Copy server/.env.example to server/.env and configure your MongoDB Atlas URI.'
    );
  }

  mongoose.set('strictQuery', true);

  const conn = await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 10000,
  });

  console.log(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  return conn;
}
