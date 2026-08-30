import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import authRoutes from './routes/authRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import wishlistRoutes from './routes/wishlistRoutes.js';
import bookRoutes from './routes/books.js';
import reviewRoutes from './routes/reviewRoutes.js';
import stripeWebhookHandler from './webhook/stripeWebhook.js';
import { configureTrustProxy } from './config/trustProxy.js';

const app = express();

/*
 * Must run before anything reads req.ip — which the rate limiters on
 * /api/auth do. Without it, req.ip behind a proxy is the proxy's own address
 * on every request, so a per-IP limit applied to every user at once.
 * Defaults to trusting nothing, which is correct for a local run. See #298.
 */
configureTrustProxy(app);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Stripe webhook must be parsed as raw body
app.post(
  '/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhookHandler
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/reviews', reviewRoutes);

app.get('/', (req, res) => {
  res.send('API is running...');
});

app.use(notFound);
app.use(errorHandler);

export default app;
