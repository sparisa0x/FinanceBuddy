import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

const CreditScoresSchema = new Schema(
  {
    cibil: { type: Number },
    experian: { type: Number },
    updatedAt: { type: Date },
  },
  { _id: false }
);

const UserSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true, select: false },
    displayName: { type: String },
    isAdmin: { type: Boolean, default: false },
    isApproved: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    creditScores: { type: CreditScoresSchema, default: {} },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const hashed = await bcrypt.hash(this.password, 10);
  this.password = hashed;
  next();
});

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
