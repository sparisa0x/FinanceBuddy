import mongoose, { Schema } from 'mongoose';

const InvestmentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true },
    investedAmount: { type: Number, required: true },
    currentValue: { type: Number, required: true },
    notes: { type: String },
  },
  { timestamps: true }
);

export const Investment =
  mongoose.models.Investment || mongoose.model('Investment', InvestmentSchema);
