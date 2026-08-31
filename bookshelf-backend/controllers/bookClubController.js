import BookClub, { MEMBER_ROLES } from '../models/BookClub.js';
import User from '../models/User.js';

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Serialise a club document for the API response. Strips internal member
 * data that the caller does not need (e.g. readingProgress of others in
 * the listing view).
 */
function formatClub(club) {
  const obj = club.toObject ? club.toObject() : club;
  return {
    id: obj._id.toString(),
    name: obj.name,
    description: obj.description,
    genre: obj.genre,
    maxMembers: obj.maxMembers,
    currentBookId: obj.currentBookId,
    currentBookTitle: obj.currentBookTitle,
    isPublic: obj.isPublic,
    ownerId: obj.ownerId.toString(),
    ownerName: obj.ownerName,
    memberCount: obj.members.length,
    members: obj.members.map((m) => ({
      userId: m.userId.toString(),
      role: m.role,
      joinedAt: m.joinedAt,
      readingProgress: m.readingProgress,
    })),
    messageCount: obj.messages.length,
    tags: obj.tags,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

/**
 * Format a club for listing (less detail, no messages).
 */
function formatClubSummary(club) {
  const obj = club.toObject ? club.toObject() : club;
  return {
    id: obj._id.toString(),
    name: obj.name,
    description: obj.description,
    genre: obj.genre,
    maxMembers: obj.maxMembers,
    currentBookId: obj.currentBookId,
    currentBookTitle: obj.currentBookTitle,
    isPublic: obj.isPublic,
    ownerId: obj.ownerId.toString(),
    ownerName: obj.ownerName,
    memberCount: obj.members.length,
    tags: obj.tags,
    createdAt: obj.createdAt,
  };
}

/**
 * Check if a user is a member of a club and return their member record.
 */
function getMemberRecord(club, userId) {
  return club.members.find((m) => m.userId.toString() === userId.toString());
}

/**
 * Check if a user has the required role (owner or moderator).
 */
function hasPrivilegedRole(memberRecord) {
  return memberRecord && (memberRecord.role === 'owner' || memberRecord.role === 'moderator');
}

// ── Create a new club ─────────────────────────────────────────────────────

/**
 * @desc    Create a new book club
 * @route   POST /api/book-clubs
 * @access  Authenticated
 */
export const createClub = async (req, res, next) => {
  try {
    const { name, description, genre, maxMembers, isPublic, tags } = req.body;

    const club = await BookClub.create({
      name,
      description: description || '',
      genre: genre || '',
      maxMembers: maxMembers || 0,
      isPublic: isPublic !== false,
      ownerId: req.user._id,
      ownerName: req.user.name,
      members: [
        {
          userId: req.user._id,
          role: 'owner',
          joinedAt: new Date(),
        },
      ],
      tags: Array.isArray(tags) ? tags.filter((t) => typeof t === 'string').slice(0, 10) : [],
    });

    res.status(201).json({
      message: 'Club created',
      club: formatClub(club),
    });
  } catch (error) {
    next(error);
  }
};

// ── List public clubs ─────────────────────────────────────────────────────

/**
 * @desc    List public book clubs (with search & pagination)
 * @route   GET /api/book-clubs
 * @access  Public
 */
export const listClubs = async (req, res, next) => {
  try {
    const { q, genre, page = 1, limit = 20 } = req.query;
    const filter = { isPublic: true };

    if (genre) {
      filter.genre = genre;
    }

    if (q) {
      filter.$text = { $search: q };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [clubs, total] = await Promise.all([
      BookClub.find(filter)
        .sort(q ? { score: { $meta: 'textScore' }, createdAt: -1 } : { createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      BookClub.countDocuments(filter),
    ]);

    res.json({
      clubs: clubs.map((c) => formatClubSummary({ toObject: () => c })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── Get clubs the current user belongs to ─────────────────────────────────

/**
 * @desc    Get clubs the authenticated user is a member of
 * @route   GET /api/book-clubs/my
 * @access  Authenticated
 */
export const getMyClubs = async (req, res, next) => {
  try {
    const clubs = await BookClub.find({
      'members.userId': req.user._id,
    })
      .sort({ updatedAt: -1 })
      .lean();

    res.json({
      clubs: clubs.map((c) => formatClubSummary({ toObject: () => c })),
    });
  } catch (error) {
    next(error);
  }
};

// ── Get a single club ─────────────────────────────────────────────────────

/**
 * @desc    Get a book club by ID (with full member list and recent messages)
 * @route   GET /api/book-clubs/:id
 * @access  Public for public clubs, members only for private clubs
 */
export const getClub = async (req, res, next) => {
  try {
    const club = await BookClub.findById(req.params.id).lean();

    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    if (!club.isPublic) {
      const isMember = club.members.some(
        (m) => m.userId.toString() === req.user?._id?.toString()
      );
      if (!isMember) {
        return res.status(403).json({ message: 'This club is private' });
      }
    }

    // Return last 50 messages
    const recentMessages = club.messages.slice(-50);

    res.json({
      club: {
        ...formatClub({ toObject: () => club }),
        messages: recentMessages.map((m) => ({
          ...m,
          _id: m._id?.toString(),
          authorId: m.authorId.toString(),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── Update club settings ──────────────────────────────────────────────────

/**
 * @desc    Update club settings (owner only)
 * @route   PUT /api/book-clubs/:id
 * @access  Authenticated (owner only)
 */
export const updateClub = async (req, res, next) => {
  try {
    const club = await BookClub.findById(req.params.id);

    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    if (club.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the owner can update club settings' });
    }

    const { name, description, genre, maxMembers, isPublic, tags } = req.body;

    if (name !== undefined) club.name = name;
    if (description !== undefined) club.description = description;
    if (genre !== undefined) club.genre = genre;
    if (maxMembers !== undefined) club.maxMembers = maxMembers;
    if (isPublic !== undefined) club.isPublic = isPublic;
    if (tags !== undefined) {
      club.tags = Array.isArray(tags) ? tags.filter((t) => typeof t === 'string').slice(0, 10) : [];
    }

    await club.save();

    res.json({
      message: 'Club updated',
      club: formatClub(club),
    });
  } catch (error) {
    next(error);
  }
};

// ── Delete a club ─────────────────────────────────────────────────────────

/**
 * @desc    Delete a book club (owner only)
 * @route   DELETE /api/book-clubs/:id
 * @access  Authenticated (owner only)
 */
export const deleteClub = async (req, res, next) => {
  try {
    const club = await BookClub.findById(req.params.id);

    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    if (club.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the owner can delete the club' });
    }

    await BookClub.findByIdAndDelete(req.params.id);

    res.json({ message: 'Club deleted' });
  } catch (error) {
    next(error);
  }
};

// ── Join a club ───────────────────────────────────────────────────────────

/**
 * @desc    Join a public book club
 * @route   POST /api/book-clubs/:id/join
 * @access  Authenticated
 */
export const joinClub = async (req, res, next) => {
  try {
    const club = await BookClub.findById(req.params.id);

    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    if (!club.isPublic) {
      return res.status(403).json({ message: 'This club is private. Ask the owner for an invite.' });
    }

    const existing = getMemberRecord(club, req.user._id);
    if (existing) {
      return res.status(400).json({ message: 'Already a member of this club' });
    }

    if (club.maxMembers > 0 && club.members.length >= club.maxMembers) {
      return res.status(400).json({ message: 'Club is full' });
    }

    club.members.push({
      userId: req.user._id,
      role: 'member',
      joinedAt: new Date(),
    });

    await club.save();

    res.json({
      message: 'Joined the club',
      club: formatClub(club),
    });
  } catch (error) {
    next(error);
  }
};

// ── Leave a club ──────────────────────────────────────────────────────────

/**
 * @desc    Leave a book club (owner must transfer ownership first)
 * @route   POST /api/book-clubs/:id/leave
 * @access  Authenticated
 */
export const leaveClub = async (req, res, next) => {
  try {
    const club = await BookClub.findById(req.params.id);

    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    if (club.ownerId.toString() === req.user._id.toString()) {
      return res.status(400).json({
        message: 'Owner cannot leave. Transfer ownership or delete the club.',
      });
    }

    const memberIdx = club.members.findIndex(
      (m) => m.userId.toString() === req.user._id.toString()
    );

    if (memberIdx === -1) {
      return res.status(400).json({ message: 'Not a member of this club' });
    }

    club.members.splice(memberIdx, 1);
    await club.save();

    res.json({ message: 'Left the club' });
  } catch (error) {
    next(error);
  }
};

// ── Remove a member (owner/moderator) ────────────────────────────────────

/**
 * @desc    Remove a member from the club
 * @route   DELETE /api/book-clubs/:id/members/:userId
 * @access  Authenticated (owner or moderator)
 */
export const removeMember = async (req, res, next) => {
  try {
    const club = await BookClub.findById(req.params.id);

    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    const caller = getMemberRecord(club, req.user._id);
    if (!hasPrivilegedRole(caller)) {
      return res.status(403).json({ message: 'Only owner or moderator can remove members' });
    }

    const targetId = req.params.userId;
    const targetMember = getMemberRecord(club, targetId);

    if (!targetMember) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Cannot remove the owner
    if (targetMember.role === 'owner') {
      return res.status(400).json({ message: 'Cannot remove the club owner' });
    }

    // Moderators can only remove regular members
    if (caller.role === 'moderator' && targetMember.role === 'moderator') {
      return res.status(403).json({ message: 'Moderators cannot remove other moderators' });
    }

    club.members = club.members.filter(
      (m) => m.userId.toString() !== targetId
    );

    await club.save();

    res.json({ message: 'Member removed' });
  } catch (error) {
    next(error);
  }
};

// ── Transfer ownership ───────────────────────────────────────────────────

/**
 * @desc    Transfer club ownership to another member
 * @route   POST /api/book-clubs/:id/transfer-ownership
 * @access  Authenticated (owner only)
 */
export const transferOwnership = async (req, res, next) => {
  try {
    const club = await BookClub.findById(req.params.id);

    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    if (club.ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the owner can transfer ownership' });
    }

    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    const newOwner = getMemberRecord(club, userId);
    if (!newOwner) {
      return res.status(404).json({ message: 'New owner must be a member' });
    }

    // Demote current owner
    const currentOwner = getMemberRecord(club, req.user._id);
    currentOwner.role = 'member';

    // Promote new owner
    newOwner.role = 'owner';
    club.ownerId = userId;

    // Look up new owner's name
    const newUser = await User.findById(userId).select('name').lean();
    club.ownerName = newUser?.name || club.ownerName;

    await club.save();

    res.json({
      message: 'Ownership transferred',
      club: formatClub(club),
    });
  } catch (error) {
    next(error);
  }
};

// ── Set the current club book ─────────────────────────────────────────────

/**
 * @desc    Set or change the current book the club is reading
 * @route   PUT /api/book-clubs/:id/current-book
 * @access  Authenticated (owner or moderator)
 */
export const setCurrentBook = async (req, res, next) => {
  try {
    const club = await BookClub.findById(req.params.id);

    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    const caller = getMemberRecord(club, req.user._id);
    if (!hasPrivilegedRole(caller)) {
      return res.status(403).json({ message: 'Only owner or moderator can set the club book' });
    }

    const { bookId, bookTitle } = req.body;
    club.currentBookId = bookId;
    club.currentBookTitle = bookTitle;

    // Reset all members' progress for the new book
    for (const member of club.members) {
      member.readingProgress = null;
    }

    await club.save();

    res.json({
      message: 'Club book updated',
      club: formatClub(club),
    });
  } catch (error) {
    next(error);
  }
};

// ── Update reading progress ──────────────────────────────────────────────

/**
 * @desc    Update the caller's reading progress on the club book
 * @route   PUT /api/book-clubs/:id/progress
 * @access  Authenticated (members only)
 */
export const updateProgress = async (req, res, next) => {
  try {
    const club = await BookClub.findById(req.params.id);

    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    const member = getMemberRecord(club, req.user._id);
    if (!member) {
      return res.status(403).json({ message: 'Not a member of this club' });
    }

    if (!club.currentBookId) {
      return res.status(400).json({ message: 'No club book set yet' });
    }

    const { progress } = req.body;
    if (progress === undefined || progress < 0 || progress > 100) {
      return res.status(400).json({ message: 'Progress must be between 0 and 100' });
    }

    member.readingProgress = progress;
    await club.save();

    res.json({
      message: 'Progress updated',
      readingProgress: member.readingProgress,
    });
  } catch (error) {
    next(error);
  }
};

// ── Send a discussion message ────────────────────────────────────────────

/**
 * @desc    Post a message to the club discussion
 * @route   POST /api/book-clubs/:id/messages
 * @access  Authenticated (members only)
 */
export const sendMessage = async (req, res, next) => {
  try {
    const club = await BookClub.findById(req.params.id);

    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    const member = getMemberRecord(club, req.user._id);
    if (!member) {
      return res.status(403).json({ message: 'Not a member of this club' });
    }

    const { content, bookId } = req.body;

    const message = {
      authorId: req.user._id,
      authorName: req.user.name,
      content,
      bookId: bookId || null,
    };

    club.messages.push(message);

    // Keep messages under control — only keep the last 500
    if (club.messages.length > 500) {
      club.messages = club.messages.slice(-500);
    }

    await club.save();

    const savedMsg = club.messages[club.messages.length - 1];

    res.status(201).json({
      message: 'Message posted',
      msg: {
        _id: savedMsg._id?.toString(),
        authorId: savedMsg.authorId.toString(),
        authorName: savedMsg.authorName,
        content: savedMsg.content,
        bookId: savedMsg.bookId,
        createdAt: savedMsg.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── Delete a message ─────────────────────────────────────────────────────

/**
 * @desc    Delete a message (author, owner, or moderator)
 * @route   DELETE /api/book-clubs/:id/messages/:messageId
 * @access  Authenticated (author, owner, or moderator)
 */
export const deleteMessage = async (req, res, next) => {
  try {
    const club = await BookClub.findById(req.params.id);

    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    const member = getMemberRecord(club, req.user._id);
    if (!member) {
      return res.status(403).json({ message: 'Not a member of this club' });
    }

    const msgIdx = club.messages.findIndex(
      (m) => m._id?.toString() === req.params.messageId
    );

    if (msgIdx === -1) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const msg = club.messages[msgIdx];
    const isAuthor = msg.authorId.toString() === req.user._id.toString();
    const isPrivileged = hasPrivilegedRole(member);

    if (!isAuthor && !isPrivileged) {
      return res.status(403).json({ message: 'Not authorised to delete this message' });
    }

    club.messages.splice(msgIdx, 1);
    await club.save();

    res.json({ message: 'Message deleted' });
  } catch (error) {
    next(error);
  }
};

// ── Get club reading stats ───────────────────────────────────────────────

/**
 * @desc    Get aggregated reading progress for the club
 * @route   GET /api/book-clubs/:id/stats
 * @access  Authenticated (members only)
 */
export const getClubStats = async (req, res, next) => {
  try {
    const club = await BookClub.findById(req.params.id).lean();

    if (!club) {
      return res.status(404).json({ message: 'Club not found' });
    }

    const isMember = club.members.some(
      (m) => m.userId.toString() === req.user?._id?.toString()
    );

    if (!isMember) {
      return res.status(403).json({ message: 'Not a member of this club' });
    }

    const members = club.members;
    const totalMembers = members.length;
    const membersReading = members.filter((m) => m.readingProgress !== null);
    const avgProgress =
      membersReading.length > 0
        ? Math.round(
            membersReading.reduce((sum, m) => sum + m.readingProgress, 0) /
              membersReading.length
          )
        : 0;
    const membersFinished = membersReading.filter((m) => m.readingProgress === 100).length;

    res.json({
      totalMembers,
      membersReading: membersReading.length,
      membersFinished,
      avgProgress,
      currentBookId: club.currentBookId,
      currentBookTitle: club.currentBookTitle,
      members: members.map((m) => ({
        userId: m.userId.toString(),
        role: m.role,
        readingProgress: m.readingProgress,
      })),
    });
  } catch (error) {
    next(error);
  }
};

export default {
  createClub,
  listClubs,
  getMyClubs,
  getClub,
  updateClub,
  deleteClub,
  joinClub,
  leaveClub,
  removeMember,
  transferOwnership,
  setCurrentBook,
  updateProgress,
  sendMessage,
  deleteMessage,
  getClubStats,
};
