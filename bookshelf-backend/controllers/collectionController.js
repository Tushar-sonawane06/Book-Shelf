import Collection from '../models/Collection.js';
import {
  MAX_BOOKS_PER_COLLECTION,
  hasCapacity,
} from '../utils/collection.js';

/*
 * Every write route here runs behind `validateBody(schema)` — see
 * routes/collectionRoutes.js. That is what lets the handlers below read
 * req.body directly again: by the time one runs, `name` is a trimmed
 * non-empty string, `description` is a trimmed string or absent, `isPublic`
 * is a real boolean or absent, and `bookId` is a trimmed non-empty string.
 * Nothing else survives the middleware.
 *
 * The `.trim()` calls that used to be here were not defensive — they were the
 * bug. `name.trim()` on a request without a name threw a TypeError that
 * reached the client as a 500, and `String(req.body.bookId).trim()` turned a
 * missing id into the seven-character string "undefined", which is truthy and
 * was stored. See #419.
 */

// ── Get all collections for the current user ───────────────────────────────

export const getCollections = async (req, res, next) => {
  try {
    const collections = await Collection.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();
    res.json(collections.map((c) => ({ ...c, id: c._id.toString() })));
  } catch (error) {
    next(error);
  }
};

// ── Get a single collection by id ──────────────────────────────────────────

export const getCollection = async (req, res, next) => {
  try {
    const col = await Collection.findById(req.params.id).lean();
    if (!col) return res.status(404).json({ message: 'Collection not found' });
    if (col.userId.toString() !== req.user._id.toString() && !col.isPublic) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    res.json({ ...col, id: col._id.toString() });
  } catch (error) {
    next(error);
  }
};

// ── Create a new collection ────────────────────────────────────────────────

export const createCollection = async (req, res, next) => {
  try {
    const { name, description, isPublic } = req.body;
    const col = await Collection.create({
      userId: req.user._id,
      name,
      description: description ?? '',
      /*
       * `?? false`, not `Boolean(isPublic)`. The old coercion made the string
       * "false" — what an HTML form sends for an unchecked box — public.
       * The validator has already turned "false" into `false`; all this has
       * to do is supply the default when the field was omitted.
       */
      isPublic: isPublic ?? false,
    });
    res.status(201).json({ message: 'Collection created', collection: { ...col.toObject(), id: col._id.toString() } });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'A collection with that name already exists' });
    }
    next(error);
  }
};

// ── Update name / description / isPublic ───────────────────────────────────

export const updateCollection = async (req, res, next) => {
  try {
    const col = await Collection.findById(req.params.id);
    if (!col) return res.status(404).json({ message: 'Collection not found' });
    if (col.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    /*
     * A partial update: only the fields actually sent are touched. The
     * validator does not require any of them, so a request that flips
     * `isPublic` alone does not have to resend the name.
     */
    const { name, description, isPublic } = req.body;
    if (name !== undefined) col.name = name;
    if (description !== undefined) col.description = description;
    if (isPublic !== undefined) col.isPublic = isPublic;
    const saved = await col.save();
    res.json({ message: 'Collection updated', collection: { ...saved.toObject(), id: saved._id.toString() } });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'A collection with that name already exists' });
    }
    next(error);
  }
};

// ── Delete a collection ────────────────────────────────────────────────────

export const deleteCollection = async (req, res, next) => {
  try {
    const col = await Collection.findById(req.params.id);
    if (!col) return res.status(404).json({ message: 'Collection not found' });
    if (col.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    await col.deleteOne();
    res.json({ message: 'Collection deleted' });
  } catch (error) {
    next(error);
  }
};

// ── Add a book to a collection ─────────────────────────────────────────────

export const addBook = async (req, res, next) => {
  try {
    const col = await Collection.findById(req.params.id);
    if (!col) return res.status(404).json({ message: 'Collection not found' });
    if (col.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const { bookId } = req.body;

    if (col.bookIds.includes(bookId)) {
      return res.status(409).json({ message: 'Book already in collection' });
    }

    /*
     * `bookIds` had no bound, so a loop over this endpoint grew one document
     * until it hit Mongo's 16 MB limit — after which every save on that
     * collection fails, not only the ones adding books. The wishlist was
     * capped for the same reason.
     */
    if (!hasCapacity(col.bookIds)) {
      return res.status(409).json({
        message: `A collection can hold at most ${MAX_BOOKS_PER_COLLECTION} books`,
      });
    }

    col.bookIds.push(bookId);
    await col.save();
    res.json({ message: 'Book added', bookIds: col.bookIds });
  } catch (error) {
    next(error);
  }
};

// ── Remove a book from a collection ────────────────────────────────────────

export const removeBook = async (req, res, next) => {
  try {
    const col = await Collection.findById(req.params.id);
    if (!col) return res.status(404).json({ message: 'Collection not found' });
    if (col.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const { bookId } = req.params;
    const idx = col.bookIds.indexOf(bookId);
    if (idx === -1) return res.status(404).json({ message: 'Book not in collection' });
    col.bookIds.splice(idx, 1);
    await col.save();
    res.json({ message: 'Book removed', bookIds: col.bookIds });
  } catch (error) {
    next(error);
  }
};
