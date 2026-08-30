import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import { validate } from '../utils/validators.js';
import {
  MAX_BOOKS_PER_COLLECTION,
  MAX_COLLECTION_DESCRIPTION_LENGTH,
  MAX_COLLECTION_NAME_LENGTH,
  booleanRule,
  hasCapacity,
  normaliseBoolean,
  normaliseOptionalText,
  optionalTextRule,
  presentTextRule,
} from '../utils/collection.js';
import {
  addBookSchema,
  createCollectionSchema,
  updateCollectionSchema,
} from '../validators/collectionValidators.js';
import collectionRouter from '../routes/collectionRoutes.js';

/**
 * The collections routes were the last write endpoints in the API with no
 * `validateBody` in front of them, and the controller behind them called
 * string methods on values it had not checked. See #419.
 *
 * These run the schemas through the same `validate()` the middleware uses, so
 * a passing test here is the same computation the route performs.
 */

/** Runs a schema the way `validateBody` does, and reports both halves. */
function run(schema, body) {
  const { errors, values } = validate(body, schema);
  return { errors, values, messages: errors.map((error) => error.message) };
}

describe('createCollectionSchema — the 500 that should have been a 400', () => {
  test('an empty body is a field error, not a TypeError', () => {
    /*
     * The original: `name.trim()` on `undefined`, which threw
     * `Cannot read properties of undefined (reading 'trim')` and reached the
     * client through the error middleware as a 500.
     */
    const { errors } = run(createCollectionSchema, {});

    assert.equal(errors.length, 1);
    assert.equal(errors[0].field, 'name');
    assert.match(errors[0].message, /required/);
  });

  test('a missing body at all is a field error', () => {
    const { errors } = run(createCollectionSchema, undefined);
    assert.equal(errors[0].field, 'name');
  });

  test('a whitespace-only name is refused', () => {
    const { errors } = run(createCollectionSchema, { name: '   ' });
    assert.equal(errors[0].field, 'name');
    assert.match(errors[0].message, /cannot be empty/);
  });

  test('a non-string name is named rather than coerced', () => {
    for (const name of [42, true, {}, []]) {
      const { errors } = run(createCollectionSchema, { name });
      assert.equal(errors.length, 1, `name=${JSON.stringify(name)}`);
      assert.equal(errors[0].field, 'name');
    }
  });

  test('a name is trimmed before it is stored', () => {
    const { errors, values } = run(createCollectionSchema, { name: '  Summer reads  ' });

    assert.equal(errors.length, 0);
    assert.equal(values.name, 'Summer reads');
  });

  test('an over-length name is a 400 rather than a Mongoose ValidationError', () => {
    // The schema caps name at 80. Without a validator that cap was enforced
    // by Mongoose, whose ValidationError went through next(error) as a 500.
    const { errors } = run(createCollectionSchema, {
      name: 'x'.repeat(MAX_COLLECTION_NAME_LENGTH + 1),
    });

    assert.equal(errors[0].field, 'name');
    assert.match(errors[0].message, /at most 80 characters/);
  });

  test('a name exactly at the cap is allowed', () => {
    const { errors } = run(createCollectionSchema, {
      name: 'x'.repeat(MAX_COLLECTION_NAME_LENGTH),
    });

    assert.equal(errors.length, 0);
  });

  test('an over-length description is refused', () => {
    const { errors } = run(createCollectionSchema, {
      name: 'Fine',
      description: 'x'.repeat(MAX_COLLECTION_DESCRIPTION_LENGTH + 1),
    });

    assert.equal(errors[0].field, 'description');
  });

  test('a non-string description is refused rather than trimmed', () => {
    // `description.trim()` on a number threw the same TypeError the name did.
    const { errors } = run(createCollectionSchema, { name: 'Fine', description: 7 });

    assert.equal(errors[0].field, 'description');
    assert.match(errors[0].message, /must be a string/);
  });

  test('description is optional', () => {
    const { errors, values } = run(createCollectionSchema, { name: 'Fine' });

    assert.equal(errors.length, 0);
    assert.equal(values.description, undefined);
  });

  test('unexpected keys are dropped, not passed to the database', () => {
    const { values } = run(createCollectionSchema, {
      name: 'Fine',
      userId: '000000000000000000000000',
      bookIds: ['b1', 'b2'],
      createdAt: '1999-01-01',
    });

    assert.deepEqual(Object.keys(values).sort(), ['description', 'isPublic', 'name']);
  });
});

describe('isPublic — the string "false" that made a collection public', () => {
  test('the string "false" becomes false, not true', () => {
    /*
     * `Boolean("false")` is `true`. An unchecked HTML checkbox sends the
     * string, so a user who left the box alone got a public collection.
     */
    const { errors, values } = run(createCollectionSchema, {
      name: 'Private list',
      isPublic: 'false',
    });

    assert.equal(errors.length, 0);
    assert.equal(values.isPublic, false);
  });

  test('the string "true" becomes true', () => {
    const { values } = run(createCollectionSchema, { name: 'Public list', isPublic: 'true' });
    assert.equal(values.isPublic, true);
  });

  test('real booleans pass through untouched', () => {
    assert.equal(run(createCollectionSchema, { name: 'x', isPublic: true }).values.isPublic, true);
    assert.equal(run(createCollectionSchema, { name: 'x', isPublic: false }).values.isPublic, false);
  });

  test('the other form spellings are understood', () => {
    for (const [raw, expected] of [
      ['on', true], ['off', false],
      ['1', true], ['0', false],
      ['yes', true], ['no', false],
      ['TRUE', true], ['  False  ', false],
    ]) {
      assert.equal(normaliseBoolean(raw), expected, `isPublic=${JSON.stringify(raw)}`);
    }
  });

  test('anything else is refused rather than guessed at', () => {
    // Boolean("maybe") is true. A caller who meant private deserves an error.
    for (const isPublic of ['maybe', 'public', 2, {}, []]) {
      const { errors } = run(createCollectionSchema, { name: 'x', isPublic });
      assert.equal(errors.length, 1, `isPublic=${JSON.stringify(isPublic)}`);
      assert.equal(errors[0].field, 'isPublic');
      assert.match(errors[0].message, /must be true or false/);
    }
  });

  test('isPublic is optional', () => {
    const { errors } = run(createCollectionSchema, { name: 'x' });
    assert.equal(errors.length, 0);
  });
});

describe('addBookSchema — the "undefined" that was stored as a book id', () => {
  test('an empty body is refused', () => {
    /*
     * The original guard:
     *
     *   const bookId = String(req.body.bookId).trim();
     *   if (!bookId) return res.status(400)...
     *
     * `String(undefined)` is 'undefined' — seven characters, and truthy — so
     * the guard passed, the endpoint answered 200, and the collection
     * permanently contained a book id of "undefined".
     */
    const { errors } = run(addBookSchema, {});

    assert.equal(errors.length, 1);
    assert.equal(errors[0].field, 'bookId');
    assert.match(errors[0].message, /required/);
  });

  test('the literal string "undefined" is not what a missing id becomes', () => {
    const { values } = run(addBookSchema, {});
    assert.notEqual(values.bookId, 'undefined');
    assert.equal(values.bookId, undefined);
  });

  test('null is refused', () => {
    const { errors } = run(addBookSchema, { bookId: null });
    assert.equal(errors[0].field, 'bookId');
  });

  test('a non-string id is refused rather than stringified', () => {
    // String(123) is "123", String(true) is "true" — both were stored.
    for (const bookId of [123, true, {}, ['b1']]) {
      const { errors } = run(addBookSchema, { bookId });
      assert.equal(errors.length, 1, `bookId=${JSON.stringify(bookId)}`);
      assert.equal(errors[0].field, 'bookId');
    }
  });

  test('a whitespace-only id is refused', () => {
    const { errors } = run(addBookSchema, { bookId: '   ' });
    assert.equal(errors[0].field, 'bookId');
  });

  test('a valid id is trimmed and kept', () => {
    const { errors, values } = run(addBookSchema, { bookId: '  b7 ' });

    assert.equal(errors.length, 0);
    assert.equal(values.bookId, 'b7');
  });

  test('control characters are refused, as they are in a wishlist id', () => {
    const { errors } = run(addBookSchema, { bookId: `b1${String.fromCharCode(10)}injected` });
    assert.equal(errors[0].field, 'bookId');
  });

  test('an absurdly long id is refused', () => {
    const { errors } = run(addBookSchema, { bookId: 'b'.repeat(500) });
    assert.equal(errors[0].field, 'bookId');
  });
});

describe('updateCollectionSchema — a partial update stays partial', () => {
  test('an empty body is valid: nothing is being changed', () => {
    const { errors } = run(updateCollectionSchema, {});
    assert.equal(errors.length, 0);
  });

  test('flipping isPublic alone does not require the name', () => {
    // The point of not reusing createCollectionSchema here.
    const { errors, values } = run(updateCollectionSchema, { isPublic: true });

    assert.equal(errors.length, 0);
    assert.equal(values.isPublic, true);
    assert.equal(values.name, undefined);
  });

  test('a name that is present must still be usable', () => {
    const { errors } = run(updateCollectionSchema, { name: '' });

    assert.equal(errors.length, 1);
    assert.equal(errors[0].field, 'name');
    assert.match(errors[0].message, /cannot be empty/);
  });

  test('a present name is trimmed', () => {
    const { values } = run(updateCollectionSchema, { name: '  Renamed ' });
    assert.equal(values.name, 'Renamed');
  });

  test('a description can be cleared with an empty string', () => {
    // Distinct from omitting it, which leaves the stored value alone.
    const { errors, values } = run(updateCollectionSchema, { description: '' });

    assert.equal(errors.length, 0);
    assert.equal(values.description, '');
  });

  test('an over-length name is refused on update too', () => {
    const { errors } = run(updateCollectionSchema, {
      name: 'x'.repeat(MAX_COLLECTION_NAME_LENGTH + 1),
    });

    assert.equal(errors[0].field, 'name');
  });
});

describe('the primitives', () => {
  test('normaliseOptionalText leaves absence alone', () => {
    assert.equal(normaliseOptionalText(undefined), undefined);
    assert.equal(normaliseOptionalText(null), null);
    assert.equal(normaliseOptionalText('  x '), 'x');
    assert.equal(normaliseOptionalText(7), 7);
  });

  test('optionalTextRule accepts absence and rejects a bad present value', () => {
    const rule = optionalTextRule('field', 5);

    assert.equal(rule(undefined), null);
    assert.equal(rule('abc'), null);
    assert.match(rule('abcdef'), /at most 5/);
    assert.match(rule(7), /must be a string/);
  });

  test('presentTextRule differs from optionalTextRule only on the empty string', () => {
    assert.equal(optionalTextRule('f', 5)(''), null);
    assert.match(presentTextRule('f', 5)(''), /cannot be empty/);
    assert.equal(presentTextRule('f', 5)(undefined), null);
  });

  test('booleanRule accepts absence', () => {
    assert.equal(booleanRule('f')(undefined), null);
    assert.equal(booleanRule('f')(null), null);
    assert.equal(booleanRule('f')(true), null);
    assert.match(booleanRule('f')('maybe'), /true or false/);
  });

  test('hasCapacity bounds a collection', () => {
    assert.equal(hasCapacity([]), true);
    assert.equal(hasCapacity(new Array(MAX_BOOKS_PER_COLLECTION - 1).fill('b')), true);
    assert.equal(hasCapacity(new Array(MAX_BOOKS_PER_COLLECTION).fill('b')), false);
    // A document written before `bookIds` existed.
    assert.equal(hasCapacity(undefined), true);
  });
});

describe('the schemas compose with the existing validate()', () => {
  test('one error per field, as everywhere else in the API', () => {
    const { errors } = run(createCollectionSchema, {
      name: '',
      description: 7,
      isPublic: 'maybe',
    });

    assert.equal(errors.length, 3);
    assert.deepEqual(errors.map((error) => error.field).sort(), [
      'description',
      'isPublic',
      'name',
    ]);
  });

  test('a fully valid create body normalises to exactly what the model wants', () => {
    const { errors, values } = run(createCollectionSchema, {
      name: '  Winter 2026  ',
      description: '  Long evenings  ',
      isPublic: 'true',
    });

    assert.equal(errors.length, 0);
    assert.deepEqual(values, {
      name: 'Winter 2026',
      description: 'Long evenings',
      isPublic: true,
    });
  });
});

/**
 * The schemas above are only worth anything if the routes actually run them.
 *
 * That is the shape of this whole bug: the rules were not subtly wrong, they
 * were absent, and a validator sitting in `validators/` that no route mounts
 * is exactly as useful as no validator at all. This reads the router's own
 * stack, so it fails if someone removes a `validateBody` while leaving the
 * schema file in place.
 */
describe('routes/collectionRoutes.js — the middleware is actually mounted', () => {
  /** The handler chain Express will run for one method and path. */
  function handlersFor(method, routePath) {
    for (const layer of collectionRouter.stack) {
      if (!layer.route || layer.route.path !== routePath) continue;

      const handlers = layer.route.stack.filter((entry) => entry.method === method);
      if (handlers.length > 0) return handlers;
    }

    return [];
  }

  for (const [method, routePath] of [
    ['post', '/'],
    ['put', '/:id'],
    ['post', '/:id/books'],
  ]) {
    test(`${method.toUpperCase()} ${routePath} validates the body before the controller`, () => {
      const handlers = handlersFor(method, routePath);

      assert.equal(
        handlers.length,
        2,
        `${method.toUpperCase()} ${routePath} should be [validateBody, controller]`
      );

      /*
       * `validateBody` returns an anonymous closure, which Express reports as
       * '<anonymous>'; the controller is a named export. So the unnamed one
       * runs first and the named one second — which is the ordering that
       * matters, since a validator mounted after its controller validates
       * nothing.
       */
      const [first, second] = handlers;

      assert.equal(first.name, '<anonymous>', 'the validator should run first');
      assert.notEqual(second.name, '<anonymous>', 'the controller should run second');
      assert.match(
        second.name,
        /^(createCollection|updateCollection|addBook)$/,
        'the second handler should be the collection controller'
      );
    });
  }

  test('leaves the read and delete routes alone', () => {
    // Nothing to validate in a body that is not sent. Adding a schema here
    // would only strip the request of fields it never had.
    assert.equal(handlersFor('get', '/').length, 1);
    assert.equal(handlersFor('get', '/:id').length, 1);
    assert.equal(handlersFor('delete', '/:id').length, 1);
    assert.equal(handlersFor('delete', '/:id/books/:bookId').length, 1);
  });

  test('still requires a session for every route', () => {
    // router.use(protect) — a router-level layer, so it has no .route.
    const middleware = collectionRouter.stack.filter((layer) => !layer.route);

    assert.ok(
      middleware.some((layer) => layer.name === 'protect'),
      'collections must stay behind protect'
    );
  });
});
