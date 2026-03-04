import mongoose, { Schema } from 'mongoose';

const DebtSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    creditor: { type: String, required: true },
    amount: { type: Number, required: true },
    interestRate: { type: Number },
    dueDate: { type: Date },
    status: { type: String, enum: ['active', 'paid'], default: 'active' },
  },
  { timestamps: true }
);

export const Debt = mongoose.models.Debt || mongoose.model('Debt', DebtSchema);
