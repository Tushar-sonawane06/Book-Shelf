import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/api.js', () => ({
  default: { get: vi.fn() },
}));

const api = (await import('../utils/api.js')).default;
const { getBooksByIds, createBook, updateBook, deleteBook, updateBookStock, BookNotFoundError } = await import('./bookService.js');

/**
 * The wishlist stores ids and nothing else, so something has to turn them
 * into books. That used to be a filter over a stale hardcoded array, which
 * silently dropped anything it did not recognise. See #328.
 */

function bookResponse(book) {
  return { data: book };
}

/** The normalised shape utils/api.js rejects with. */
function notFound(id) {
  return { status: 404, code: 'NOT_FOUND', message: `Book not found: ${id}` };
}

describe('getBooksByIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves every id against the API', async () => {
    api.get.mockImplementation((url) =>
      Promise.resolve(bookResponse({ id: url.split('/').pop(), title: url }))
    );

    const result = await getBooksByIds(['b1', 'b2']);

    expect(result.books.map((b) => b.id)).toEqual(['b1', 'b2']);
    expect(result.missingIds).toEqual([]);
    expect(result.failedIds).toEqual([]);
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('reports a 404 as missing rather than dropping it silently', async () => {
    api.get.mockImplementation((url) =>
      url.endsWith('s3')
        ? Promise.reject(notFound('s3'))
        : Promise.resolve(bookResponse({ id: 'b1' }))
    );

    const result = await getBooksByIds(['b1', 's3']);

    expect(result.books.map((b) => b.id)).toEqual(['b1']);
    expect(result.missingIds).toEqual(['s3']);
    expect(result.failedIds).toEqual([]);
  });

  it('separates "not in the catalogue" from "could not be fetched"', async () => {
    // Saying a book has been delisted when the request merely timed out
    // would be a lie told by a flaky network.
    api.get.mockImplementation((url) => {
      if (url.endsWith('s3')) return Promise.reject(notFound('s3'));
      if (url.endsWith('b2')) {
        return Promise.reject({ status: 0, code: 'NETWORK_ERROR', message: 'Network error.' });
      }
      return Promise.resolve(bookResponse({ id: 'b1' }));
    });

    const result = await getBooksByIds(['b1', 'b2', 's3']);

    expect(result.books.map((b) => b.id)).toEqual(['b1']);
    expect(result.missingIds).toEqual(['s3']);
    expect(result.failedIds).toEqual(['b2']);
  });

  it('treats the service\'s own BookNotFoundError as missing', async () => {
    api.get.mockRejectedValue(new BookNotFoundError('b9'));

    const result = await getBooksByIds(['b9']);

    expect(result.missingIds).toEqual(['b9']);
    expect(result.failedIds).toEqual([]);
  });

  it('one failure does not lose the books that did resolve', async () => {
    api.get.mockImplementation((url) =>
      url.endsWith('b2')
        ? Promise.reject({ status: 500, message: 'boom' })
        : Promise.resolve(bookResponse({ id: url.split('/').pop() }))
    );

    const result = await getBooksByIds(['b1', 'b2', 'b3']);

    expect(result.books.map((b) => b.id)).toEqual(['b1', 'b3']);
    expect(result.failedIds).toEqual(['b2']);
  });

  it('fetches each id once even if the list repeats it', async () => {
    api.get.mockResolvedValue(bookResponse({ id: 'b1' }));

    const result = await getBooksByIds(['b1', 'b1', 'b1']);

    expect(api.get).toHaveBeenCalledTimes(1);
    expect(result.books).toHaveLength(1);
  });

  it('ignores entries that are not usable ids', async () => {
    api.get.mockResolvedValue(bookResponse({ id: 'b1' }));

    await getBooksByIds(['b1', '', '   ', null, undefined, 42]);

    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('makes no request at all for an empty or invalid list', async () => {
    expect(await getBooksByIds([])).toEqual({ books: [], missingIds: [], failedIds: [] });
    expect(await getBooksByIds(null)).toEqual({ books: [], missingIds: [], failedIds: [] });
    expect(await getBooksByIds(undefined)).toEqual({ books: [], missingIds: [], failedIds: [] });
    expect(api.get).not.toHaveBeenCalled();
  });

  it('passes the abort signal through to every request', async () => {
    api.get.mockResolvedValue(bookResponse({ id: 'b1' }));
    const controller = new AbortController();

    await getBooksByIds(['b1', 'b2'], { signal: controller.signal });

    for (const call of api.get.mock.calls) {
      expect(call[1]).toEqual(expect.objectContaining({ signal: controller.signal }));
    }
  });
});

describe('Admin CRUD API Service Methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls POST /books on createBook', async () => {
    api.post = vi.fn().mockResolvedValue({ data: { id: 'b99', title: 'New Book' } });
    const payload = { title: 'New Book', price: 299, inventory: 5 };
    const result = await createBook(payload);

    expect(api.post).toHaveBeenCalledWith('/books', payload);
    expect(result).toEqual({ id: 'b99', title: 'New Book' });
  });

  it('calls PUT /books/:id on updateBook', async () => {
    api.put = vi.fn().mockResolvedValue({ data: { id: 'b1', title: 'Updated Book' } });
    const payload = { title: 'Updated Book' };
    const result = await updateBook('b1', payload);

    expect(api.put).toHaveBeenCalledWith('/books/b1', payload);
    expect(result).toEqual({ id: 'b1', title: 'Updated Book' });
  });

  it('calls DELETE /books/:id on deleteBook', async () => {
    api.delete = vi.fn().mockResolvedValue({ data: { message: 'Book deleted' } });
    const result = await deleteBook('b1');

    expect(api.delete).toHaveBeenCalledWith('/books/b1');
    expect(result).toEqual({ message: 'Book deleted' });
  });

  it('calls PATCH /books/:id/stock on updateBookStock', async () => {
    api.patch = vi.fn().mockResolvedValue({ data: { id: 'b1', inventory: 15 } });
    const result = await updateBookStock('b1', { inventory: 15 });

    expect(api.patch).toHaveBeenCalledWith('/books/b1/stock', { inventory: 15 });
    expect(result).toEqual({ id: 'b1', inventory: 15 });
  });
});
