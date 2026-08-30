import mongoose from 'mongoose';

const stockAlertSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bookId: { type: String, required: true, trim: true },
    notified: { type: Boolean, default: false },
    notifiedAt: { type: Date },
  },
  { timestamps: true }
);

stockAlertSchema.index({ userId: 1, bookId: 1 }, { unique: true });
stockAlertSchema.index({ bookId: 1, notified: 1 });

const StockAlert = mongoose.model('StockAlert', stockAlertSchema);
export default StockAlert;
