import mongoose, { Schema } from 'mongoose';

const SessionSchema = new Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: true },
  createdAt: { type: Date, default: Date.now },
  lastUsedAt: { type: Date },
  revokedAt: { type: Date },
  ip: { type: String },
  userAgent: { type: String },
});

SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = mongoose.models.Session || mongoose.model('Session', SessionSchema);
