import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Book from '../models/Book.js';
import cacheManager from '../utils/cacheManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const booksFilePath = path.join(__dirname, '../data/books.json');

/** Check if MongoDB is connected and ready. */
const isMongoConnected = () => mongoose.connection.readyState === 1;

/**
 * Sync MongoDB with JSON file if MongoDB collection is empty.
 */
export const syncDatabaseWithJson = async () => {
  if (!isMongoConnected()) return;
  try {
    const count = await Book.countDocuments();
    if (count === 0) {
      console.log('[bookRepository] MongoDB Book collection empty. Seeding from books.json...');
      if (fs.existsSync(booksFilePath)) {
        const rawData = fs.readFileSync(booksFilePath, 'utf8');
        const books = JSON.parse(rawData);
        if (Array.isArray(books) && books.length > 0) {
          const docs = books.map((b) => ({
            id: b.id,
            title: b.title,
            author: b.author,
            genre: b.genre,
            price: Number(b.price),
            rating: b.rating !== undefined ? Number(b.rating) : 0,
            reviewsCount: b.reviewsCount !== undefined ? Number(b.reviewsCount) : 0,
            inventory: b.inventory !== undefined ? Number(b.inventory) : 0,
            description: b.description || '',
            coverImage: b.coverImage || '',
            pages: b.pages !== undefined ? Number(b.pages) : 0,
            __v: b.__v || 0,
          }));
          await Book.insertMany(docs);
          console.log(`[bookRepository] Successfully seeded ${docs.length} books into MongoDB.`);
        }
      }
    }
  } catch (error) {
    console.error('[bookRepository] Error syncing MongoDB with JSON:', error.message);
  }
};

/**
 * Get all books synchronously (from Cache / Disk fallback for legacy compatibility).
 */
export const getBooks = () => {
  const cachedBooks = cacheManager.get('books');
  if (cachedBooks) {
    return cachedBooks;
  }

  try {
    const data = fs.readFileSync(booksFilePath, 'utf8');
    const books = JSON.parse(data);
    cacheManager.set('books', books);
    return books;
  } catch (error) {
    console.error('Error reading books data from disk:', error);
    return [];
  }
};

/**
 * Async fetch all books (queries MongoDB if connected, else uses disk/cache).
 */
export const getBooksAsync = async () => {
  if (isMongoConnected()) {
    try {
      const dbBooks = await Book.find({}).lean();
      if (dbBooks.length > 0) {
        cacheManager.set('books', dbBooks);
        return dbBooks;
      }
    } catch (err) {
      console.error('[bookRepository] MongoDB query failed, falling back to disk:', err.message);
    }
  }
  return getBooks();
};

/**
 * Get book by ID.
 */
export const getBookById = (id) => {
  const books = getBooks();
  return books.find((book) => book.id === id);
};

/**
 * Async fetch book by ID.
 */
export const getBookByIdAsync = async (id) => {
  if (isMongoConnected()) {
    try {
      const book = await Book.findOne({ id }).lean();
      if (book) return book;
    } catch (err) {
      console.error('[bookRepository] MongoDB findOne failed:', err.message);
    }
  }
  return getBookById(id);
};

/**
 * Optimistic Concurrency Control (OCC) inventory update.
 */
export const updateInventoryWithOCC = (itemsToUpdate) => {
  try {
    const data = fs.readFileSync(booksFilePath, 'utf8');
    const books = JSON.parse(data);

    const bookIndices = [];
    for (const item of itemsToUpdate) {
      const bookIndex = books.findIndex((b) => b.id === item.bookId);
      if (bookIndex === -1) {
        const error = new Error(`Book not found: ${item.bookId}`);
        error.status = 404;
        throw error;
      }

      const book = books[bookIndex];

      if (book.__v !== item.expectedVersion) {
        const error = new Error(
          `Version mismatch for book ${item.bookId}: Another transaction updated this book.`
        );
        error.status = 409;
        throw error;
      }

      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        const error = new Error(
          `Quantity for book ${item.bookId} must be a positive integer, received ${item.quantity}.`
        );
        error.status = 400;
        throw error;
      }

      if (book.inventory < item.quantity) {
        const error = new Error(`Insufficient inventory for book ${item.bookId}.`);
        error.status = 409;
        throw error;
      }

      bookIndices.push({ index: bookIndex, quantity: item.quantity });
    }

    for (const { index, quantity } of bookIndices) {
      books[index].inventory -= quantity;
      books[index].__v += 1;
    }

    fs.writeFileSync(booksFilePath, JSON.stringify(books, null, 2), 'utf8');
    cacheManager.del('books');

    // Also update Mongo in background if connected
    if (isMongoConnected()) {
      Promise.all(
        itemsToUpdate.map((item) =>
          Book.findOneAndUpdate(
            { id: item.bookId, __v: item.expectedVersion, inventory: { $gte: item.quantity } },
            { $inc: { inventory: -item.quantity, __v: 1 } }
          )
        )
      ).catch((err) => console.error('[bookRepository] Async Mongo OCC update error:', err));
    }

    return true;
  } catch (error) {
    throw error;
  }
};

/**
 * Async OCC inventory update.
 */
export const updateInventoryWithOCCAsync = async (itemsToUpdate) => {
  if (isMongoConnected()) {
    for (const item of itemsToUpdate) {
      const book = await Book.findOne({ id: item.bookId });
      if (!book) {
        const error = new Error(`Book not found: ${item.bookId}`);
        error.status = 404;
        throw error;
      }
      if (book.__v !== item.expectedVersion) {
        const error = new Error(
          `Version mismatch for book ${item.bookId}: Another transaction updated this book.`
        );
        error.status = 409;
        throw error;
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        const error = new Error(
          `Quantity for book ${item.bookId} must be a positive integer, received ${item.quantity}.`
        );
        error.status = 400;
        throw error;
      }
      if (book.inventory < item.quantity) {
        const error = new Error(`Insufficient inventory for book ${item.bookId}.`);
        error.status = 409;
        throw error;
      }
    }

    for (const item of itemsToUpdate) {
      await Book.updateOne(
        { id: item.bookId },
        { $inc: { inventory: -item.quantity, __v: 1 } }
      );
    }
  }
  return updateInventoryWithOCC(itemsToUpdate);
};

/**
 * Restore reserved inventory.
 */
export const restoreInventory = (itemsToRestore) => {
  if (!Array.isArray(itemsToRestore) || itemsToRestore.length === 0) {
    return { restored: [], failed: [] };
  }

  try {
    const data = fs.readFileSync(booksFilePath, 'utf8');
    const books = JSON.parse(data);

    const restored = [];
    const failed = [];

    for (const item of itemsToRestore) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        failed.push({ bookId: item.bookId, reason: 'invalid quantity' });
        continue;
      }

      const bookIndex = books.findIndex((b) => b.id === item.bookId);

      if (bookIndex === -1) {
        failed.push({ bookId: item.bookId, reason: 'book not found' });
        continue;
      }

      books[bookIndex].inventory += item.quantity;
      books[bookIndex].__v += 1;
      restored.push({ bookId: item.bookId, quantity: item.quantity });
    }

    if (restored.length > 0) {
      fs.writeFileSync(booksFilePath, JSON.stringify(books, null, 2), 'utf8');
      cacheManager.del('books');

      if (isMongoConnected()) {
        Promise.all(
          restored.map((r) =>
            Book.updateOne({ id: r.bookId }, { $inc: { inventory: r.quantity, __v: 1 } })
          )
        ).catch((err) => console.error('[bookRepository] Async Mongo restore error:', err));
      }
    }

    return { restored, failed };
  } catch (error) {
    console.error('Failed to restore reserved inventory:', error);
    return {
      restored: [],
      failed: itemsToRestore.map((item) => ({
        bookId: item.bookId,
        reason: error.message,
      })),
    };
  }
};

/**
 * Add a new book listing.
 */
export const addBook = (bookData) => {
  const books = getBooks();
  const newId = bookData.id || `b${Date.now()}`;

  const newBook = {
    id: newId,
    title: bookData.title,
    author: bookData.author,
    genre: bookData.genre,
    price: Number(bookData.price),
    rating: bookData.rating !== undefined ? Number(bookData.rating) : 0,
    reviewsCount: bookData.reviewsCount !== undefined ? Number(bookData.reviewsCount) : 0,
    inventory: bookData.inventory !== undefined ? Number(bookData.inventory) : 0,
    description: bookData.description || '',
    coverImage: bookData.coverImage || '',
    pages: bookData.pages !== undefined ? Number(bookData.pages) : 0,
    __v: 0,
  };

  const updatedBooks = [...books, newBook];
  fs.writeFileSync(booksFilePath, JSON.stringify(updatedBooks, null, 2), 'utf8');
  cacheManager.del('books');

  if (isMongoConnected()) {
    Book.create(newBook).catch((err) =>
      console.error('[bookRepository] Mongo create book error:', err)
    );
  }

  return newBook;
};

/**
 * Update an existing book.
 */
export const updateBook = (id, updateData) => {
  const books = getBooks();
  const index = books.findIndex((b) => b.id === id);
  if (index === -1) {
    return null;
  }

  const currentBook = books[index];
  const updatedBook = {
    ...currentBook,
    ...updateData,
    id: currentBook.id,
    price: updateData.price !== undefined ? Number(updateData.price) : currentBook.price,
    rating: updateData.rating !== undefined ? Number(updateData.rating) : currentBook.rating,
    inventory: updateData.inventory !== undefined ? Number(updateData.inventory) : currentBook.inventory,
    pages: updateData.pages !== undefined ? Number(updateData.pages) : currentBook.pages,
    __v: (currentBook.__v || 0) + 1,
  };

  books[index] = updatedBook;
  fs.writeFileSync(booksFilePath, JSON.stringify(books, null, 2), 'utf8');
  cacheManager.del('books');

  if (isMongoConnected()) {
    Book.findOneAndUpdate({ id }, updatedBook).catch((err) =>
      console.error('[bookRepository] Mongo update book error:', err)
    );
  }

  return updatedBook;
};

/**
 * Delete a book.
 */
export const deleteBook = (id) => {
  const books = getBooks();
  const index = books.findIndex((b) => b.id === id);
  if (index === -1) {
    return false;
  }

  const filteredBooks = books.filter((b) => b.id !== id);
  fs.writeFileSync(booksFilePath, JSON.stringify(filteredBooks, null, 2), 'utf8');
  cacheManager.del('books');

  if (isMongoConnected()) {
    Book.deleteOne({ id }).catch((err) =>
      console.error('[bookRepository] Mongo delete book error:', err)
    );
  }

  return true;
};

/**
 * Update stock level.
 */
export const updateBookStock = (id, newInventory) => {
  return updateBook(id, { inventory: Number(newInventory) });
};

const bookRepository = {
  syncDatabaseWithJson,
  getBooks,
  getBooksAsync,
  getBookById,
  getBookByIdAsync,
  updateInventoryWithOCC,
  updateInventoryWithOCCAsync,
  restoreInventory,
  addBook,
  updateBook,
  deleteBook,
  updateBookStock,
};

export default bookRepository;
