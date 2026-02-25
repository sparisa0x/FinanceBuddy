import mongoose, { Schema } from 'mongoose';

const TransactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    category: { type: String, required: true },
    amount: { type: Number, required: true },
    note: { type: String },
    date: { type: Date, required: true },
  },
  { timestamps: true }
);

export const Transaction =
  mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);
