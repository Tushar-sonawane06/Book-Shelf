import mongoose from 'mongoose';

const collectionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },
    bookIds: [{ type: String }],
    isPublic: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

collectionSchema.index({ userId: 1, name: 1 }, { unique: true });
collectionSchema.index({ userId: 1, createdAt: -1 });

const Collection = mongoose.model('Collection', collectionSchema);
export default Collection;
