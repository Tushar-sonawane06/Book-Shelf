import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import Book from '../models/Book.js';
import bookRepository from '../repositories/bookRepository.js';

describe('Book Mongoose Model & Repository Mongo Integration', () => {
  test('Book schema constructs a valid model instance with defaults', () => {
    const bookData = {
      id: 'b_test_1',
      title: 'MongoDB Integration Architecture',
      author: 'Antigravity Team',
      genre: 'Computer Science',
      price: 49.99,
      inventory: 25,
    };

    const bookDoc = new Book(bookData);

    assert.equal(bookDoc.id, 'b_test_1');
    assert.equal(bookDoc.title, 'MongoDB Integration Architecture');
    assert.equal(bookDoc.author, 'Antigravity Team');
    assert.equal(bookDoc.price, 49.99);
    assert.equal(bookDoc.inventory, 25);
    assert.equal(bookDoc.rating, 0);
    assert.equal(bookDoc.reviewsCount, 0);
    assert.equal(bookDoc.__v, 0);
  });

  test('getBooksAsync returns array of books', async () => {
    const books = await bookRepository.getBooksAsync();
    assert.ok(Array.isArray(books));
    assert.ok(books.length > 0);
  });

  test('getBookByIdAsync finds existing book', async () => {
    const book = await bookRepository.getBookByIdAsync('b1');
    assert.ok(book);
    assert.equal(book.id, 'b1');
  });

  test('getBookByIdAsync returns null/undefined for unknown book', async () => {
    const book = await bookRepository.getBookByIdAsync('non_existent_id_999');
    assert.equal(book, undefined);
  });
});
