import express from 'express';
import {
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
} from '../controllers/bookClubController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validateBody } from '../middleware/validateBody.js';
import {
  createClubSchema,
  updateClubSchema,
  sendMessageSchema,
  setClubBookSchema,
  updateProgressSchema,
  inviteMemberSchema,
  updateRoleSchema,
} from '../validators/bookClubValidators.js';

const router = express.Router();

// ── Public routes ──────────────────────────────────────────────────────────

// List public clubs (with search)
router.get('/', listClubs);

// ── Authenticated routes ──────────────────────────────────────────────────

// Get clubs the current user belongs to (must be before /:id)
router.get('/my', protect, getMyClubs);

// Get a single club
router.get('/:id', protect, getClub);

// Create a new club
router.post('/', protect, validateBody(createClubSchema), createClub);

// Update club settings (owner only)
router.put('/:id', protect, validateBody(updateClubSchema), updateClub);

// Delete a club (owner only)
router.delete('/:id', protect, deleteClub);

// ── Membership ────────────────────────────────────────────────────────────

// Join a public club
router.post('/:id/join', protect, joinClub);

// Leave a club
router.post('/:id/leave', protect, leaveClub);

// Remove a member (owner/moderator)
router.delete('/:id/members/:userId', protect, removeMember);

// Transfer ownership
router.post('/:id/transfer-ownership', protect, transferOwnership);

// ── Club book ─────────────────────────────────────────────────────────────

// Set the current club book
router.put('/:id/current-book', protect, validateBody(setClubBookSchema), setCurrentBook);

// Update reading progress
router.put('/:id/progress', protect, validateBody(updateProgressSchema), updateProgress);

// Get club reading stats
router.get('/:id/stats', protect, getClubStats);

// ── Discussion ────────────────────────────────────────────────────────────

// Post a message
router.post('/:id/messages', protect, validateBody(sendMessageSchema), sendMessage);

// Delete a message
router.delete('/:id/messages/:messageId', protect, deleteMessage);

export default router;
