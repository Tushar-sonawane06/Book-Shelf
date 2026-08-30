import mongoose from 'mongoose';

/**
 * BookClub — a social reading group.
 *
 * Members join a club to read and discuss books together. The club owner
 * manages settings and picks the current "club book" that everyone reads.
 * Each member tracks their progress independently.
 *
 * Discussion messages are embedded inside the club document so reads are
 * fast and a single query gives the full conversation history. This is
 * appropriate because:
 *  - Clubs are small (tens, not thousands of members).
 *  - Messages are short text — the document stays well under the 16 MB
 *    Mongo limit even for very active clubs.
 *  - No need for cross-club message queries or indexing by author.
 */
const MEMBER_ROLES = ['owner', 'moderator', 'member'];

const messageSchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    bookId: {
      // Optional — tie a message to a specific book discussion
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

const memberSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: MEMBER_ROLES,
      default: 'member',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    /** Per-member progress on the current club book (0–100, null if not started). */
    readingProgress: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
  },
  { _id: false }
);

const bookClubSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    /** Optional genre focus for the club */
    genre: {
      type: String,
      trim: true,
      maxlength: 60,
      default: '',
    },
    /** Max members (0 = unlimited) */
    maxMembers: {
      type: Number,
      min: 0,
      default: 0,
    },
    /** The book currently being read together (bookId from the catalog) */
    currentBookId: {
      type: String,
      default: null,
    },
    currentBookTitle: {
      type: String,
      trim: true,
      default: '',
    },
    /** Visibility */
    isPublic: {
      type: Boolean,
      default: true,
    },
    /** Owner */
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    ownerName: {
      type: String,
      required: true,
      trim: true,
    },
    /** Embed members inside the document */
    members: {
      type: [memberSchema],
      default: [],
    },
    /** Embedded discussion messages */
    messages: {
      type: [messageSchema],
      default: [],
    },
    /** Tags for discoverability */
    tags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Allow quick lookup of clubs a user belongs to
bookClubSchema.index({ 'members.userId': 1 });
// Text search on name/description
bookClubSchema.index({ name: 'text', description: 'text' });
// Public club listing
bookClubSchema.index({ isPublic: 1, createdAt: -1 });

const BookClub = mongoose.model('BookClub', bookClubSchema);

export { MEMBER_ROLES };
export default BookClub;
