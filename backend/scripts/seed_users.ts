import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from '../src/models/User.js';
import { connectToDatabase } from '../src/config/db.js';

dotenv.config();

async function upsertUser({
  username,
  email,
  password,
  displayName,
  isAdmin,
  isApproved,
}: {
  username: string;
  email: string;
  password: string;
  displayName: string;
  isAdmin: boolean;
  isApproved: boolean;
}) {
  const existing = await User.findOne({ username }).select('+password');
  if (existing) {
    existing.email = email;
    existing.displayName = displayName;
    existing.isAdmin = isAdmin;
    existing.isApproved = isApproved;
    existing.password = password;
    await existing.save();
    console.log(`Updated user: ${username}`);
    return;
  }

  await User.create({
    username,
    email,
    password,
    displayName,
    isAdmin,
    isApproved,
  });
  console.log(`Created user: ${username}`);
}

async function run() {
  await connectToDatabase();

  await upsertUser({
    username: 'buddy',
    email: 'sriram@shravp.in',
    password: '123@Buddy',
    displayName: 'Buddy Admin',
    isAdmin: true,
    isApproved: true,
  });

  await upsertUser({
    username: 'pumpkin',
    email: 'pumpkin@financebuddy.local',
    password: '@123Pumpkin',
    displayName: 'Pumpkin User',
    isAdmin: false,
    isApproved: true,
  });
}

run()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
