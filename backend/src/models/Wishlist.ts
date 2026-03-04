import mongoose, { Schema } from 'mongoose';

const WishlistSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    itemName: { type: String, required: true },
    targetAmount: { type: Number, required: true },
    savedAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Wishlist =
  mongoose.models.Wishlist || mongoose.model('Wishlist', WishlistSchema);
