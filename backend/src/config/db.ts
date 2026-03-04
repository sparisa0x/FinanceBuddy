import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectToDatabase() {
  mongoose.set('strictQuery', true);
  return mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });
}
