import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Every router file loads.
 *
 * `routes/standaloneReviewRoutes.js` imported `voteHelpful` from
 * `controllers/reviewController.js`, which has never exported it. That is a
 * link error, not a runtime one: the module cannot be evaluated at all, and a
 * server that mounted it would have failed to boot. It sat that way because
 * nothing mounts the file and nothing imported it, so no code path ever asked
 * Node to resolve it.
 *
 * This asks. It is a cheap check and it covers the whole directory, including
 * the routers that are written but not yet mounted in `app.js` —
 * adminRoutes, collectionRoutes, couponRoutes, reviewRoutes and this one.
 * Those are exactly the files with nothing else watching them.
 */
const routesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'routes'
);

const routeFiles = (await readdir(routesDir))
  .filter((name) => name.endsWith('.js'))
  .sort();

describe('route modules', () => {
  it('finds the routers on disk', () => {
    assert.ok(routeFiles.length > 0, 'no route files found');
  });

  for (const file of routeFiles) {
    it(`${file} imports cleanly and default-exports a router`, async () => {
      const module = await import(path.join(routesDir, file));

      assert.ok(module.default, `${file} has no default export`);
      // An Express router is a function with a .stack of layers.
      assert.equal(typeof module.default, 'function', `${file} does not export a router`);
      assert.ok(Array.isArray(module.default.stack), `${file} is not an Express router`);
    });
  }
});
