#!/usr/bin/env node
/**
 * Simple migration script to hash plaintext passwords using bcryptjs.
 * Usage: set MONGODB_URI then run `node scripts/hash_passwords.js`
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('Set MONGODB_URI environment variable before running this script');
  process.exit(1);
}

const UserDataSchema = new mongoose.Schema({ username: String, password: String }, { strict: false });
const UserData = mongoose.models.UserData || mongoose.model('UserData', UserDataSchema);

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to DB');
  const users = await UserData.find({});
  let updated = 0;
  for (const u of users) {
    const pw = u.password || '';
    if (!pw.startsWith('$2')) {
      const hashed = await bcrypt.hash(pw, 10);
      u.password = hashed;
      await u.save();
      updated++;
      console.log('Hashed password for', u.username);
    }
  }
  console.log('Done. Updated:', updated);
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
