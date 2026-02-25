import mongoose, { Schema } from 'mongoose';

const OtpChallengeSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  email: { type: String, index: true },
  purpose: { type: String, required: true, index: true },
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: true },
  attempts: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

OtpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpChallenge =
  mongoose.models.OtpChallenge || mongoose.model('OtpChallenge', OtpChallengeSchema);
