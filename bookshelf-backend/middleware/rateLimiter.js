/**
 * A fixed-window rate limiter held in process memory.
 *
 * Deliberately dependency-free. The trade-off is that the counters live in
 * one process: behind more than one instance, or on a platform that recycles
 * the process, each instance enforces its own limit. For a single-instance
 * deployment that is fine, and it is a great deal better than the nothing
 * that is here today. If this ever runs on more than one instance the store
 * needs to move to Redis — the interface below is small enough that only
 * `hits` changes.
 */

const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_MAX = 10;

/**
 * Express sets req.ip from the socket, or from X-Forwarded-For when the
 * 'trust proxy' setting is on. Falling back to a constant would put every
 * unidentifiable caller in one shared bucket, which is the safe direction to
 * fail for a limiter.
 *
 * This is only as good as the 'trust proxy' setting — see
 * config/trustProxy.js. With it unset behind a proxy, every request reports
 * the proxy's address and this returns the same string for everybody.
 */
export function ipKeyGenerator(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

const defaultKeyGenerator = ipKeyGenerator;

/**
 * Key on the IP *and* the account being attempted.
 *
 * Keying on the IP alone means one attacker hammering one account exhausts
 * the budget for every user sharing that address — which, behind a proxy or
 * a corporate NAT, is all of them. The endpoint being protected is a login,
 * so the account is the more meaningful half of the identity: it bounds
 * guesses per account, which is what actually stops a password being
 * brute-forced, without letting one victim's attacker lock out bystanders.
 *
 * The email is normalised the way validators.normaliseEmail does it, because
 * this middleware runs *before* validateBody — a limiter should not have to
 * wait on body validation to decide whether to answer 429. Without
 * normalising, "Alice@Example.com" and "alice@example.com" would each get a
 * fresh budget and the per-account limit would be trivial to sidestep.
 *
 * A request with no usable email falls back to the IP alone. That is the
 * malformed-request case, and validateBody rejects it a moment later.
 */
export function ipAndEmailKeyGenerator(req) {
  const ip = ipKeyGenerator(req);
  const rawEmail = req.body?.email;

  if (typeof rawEmail !== 'string' || rawEmail.trim() === '') {
    return `${ip}|-`;
  }

  return `${ip}|${rawEmail.trim().toLowerCase()}`;
}

export function createRateLimiter({
  windowMs = DEFAULT_WINDOW_MS,
  max = DEFAULT_MAX,
  message = 'Too many requests. Please try again later.',
  keyGenerator = defaultKeyGenerator,
  resetOnSuccess = false,
  // Injectable so the tests can advance time without sleeping.
  now = () => Date.now(),
} = {}) {
  const hits = new Map();

  function prune(currentTime) {
    for (const [key, entry] of hits) {
      if (entry.expiresAt <= currentTime) {
        hits.delete(key);
      }
    }
  }

  function middleware(req, res, next) {
    const currentTime = now();
    const key = keyGenerator(req);

    let entry = hits.get(key);

    if (!entry || entry.expiresAt <= currentTime) {
      entry = { count: 0, expiresAt: currentTime + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;

    const remaining = Math.max(0, max - entry.count);
    const resetSeconds = Math.ceil((entry.expiresAt - currentTime) / 1000);

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(resetSeconds));

    if (entry.count > max) {
      res.setHeader('Retry-After', String(resetSeconds));
      return res.status(429).json({ message });
    }

    if (resetOnSuccess) {
      // Clear the counter once the response turns out to have succeeded, so
      // a legitimate user who mistypes a password a few times and then gets
      // in is not still carrying those failures.
      res.on('finish', () => {
        if (res.statusCode < 400) {
          hits.delete(key);
        }
      });
    }

    // Cheap opportunistic cleanup. Without it the map grows one entry per
    // distinct IP forever. Doing it on a fraction of requests keeps the cost
    // off the hot path; a setInterval would keep the event loop alive and
    // stop the process exiting cleanly in tests.
    if (hits.size > 1000) {
      prune(currentTime);
    }

    next();
  }

  // Exposed for tests and for a future admin endpoint.
  middleware.reset = () => hits.clear();
  middleware.size = () => hits.size;
  middleware.prune = prune;

  return middleware;
}

/**
 * Login is the endpoint worth protecting: it returns a fast, distinguishable
 * 401 for a wrong password, so it can be brute-forced as fast as the network
 * allows. Successful logins clear the counter.
 *
 * Keyed on address *and* account. Keyed on the address alone — which is what
 * this did — a single attacker running a loop of bad passwords could hold
 * the whole endpoint at 429 indefinitely: once the shared counter is over
 * the limit, `authUser` is never reached, so nobody can produce the success
 * that would reset it. That is a denial of service on authentication,
 * delivered through the control added to prevent one. See #298.
 */
export const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  resetOnSuccess: true,
  keyGenerator: ipAndEmailKeyGenerator,
  message:
    'Too many login attempts for this account. Please try again in a few minutes.',
});

/**
 * A looser ceiling per address, alongside the per-account limit above.
 *
 * The per-account limit stops one password being guessed. It does nothing
 * about credential stuffing — one attempt each against a thousand different
 * emails never trips it, because every attempt lands in a fresh bucket. This
 * bounds the total from one address.
 *
 * The number has to clear a shared NAT: an office or a school arrives as one
 * address, and a hundred attempts an hour is generous for real people and
 * still four orders of magnitude slower than a script wants. It does not
 * reset on success — the point is the aggregate rate, and a stuffing run
 * produces successes too.
 */
export const loginIpLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 100,
  keyGenerator: ipKeyGenerator,
  message:
    'Too many login attempts from this address. Please try again later.',
});

/**
 * Registration is limited more loosely — it is about stopping a script
 * filling the users collection, not about guessing a secret.
 */
export const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message:
    'Too many accounts created from this address. Please try again later.',
});

/**
 * Creating a payment intent.
 *
 * This endpoint is anonymous — guests can check out — and every successful
 * call takes inventory off the shelf before anything is paid. With 78 units
 * across the whole catalogue, an unthrottled loop emptied the shop in under a
 * minute. See #329.
 *
 * 20 an hour per address is far above what a real customer needs (a checkout
 * is one call, retried at most a handful of times) and far below what it
 * takes to drain the stock. It bounds the damage; the sweeper is what
 * actually gives the stock back.
 */
export const checkoutLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message:
    'Too many checkout attempts from this address. Please try again later.',
});

/**
 * Administrative mutations rate limiter.
 * Bounds bulk write, inventory update, and order status mutation attempts.
 */
export const adminMutationLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message:
    'Too many administrative request attempts from this address. Please try again later.',
});

export default createRateLimiter;
