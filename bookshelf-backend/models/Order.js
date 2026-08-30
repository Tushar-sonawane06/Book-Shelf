import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false, // For guest checkout in the future
    },
    items: [
      {
        bookId: { type: String, required: true },
        title: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true },
      },
    ],
    shippingAddress: {
      name: { type: String },
      address: { type: String },
      city: { type: String },
      postalCode: { type: String },
      country: { type: String },
    },
    /*
     * The currency the order was priced and charged in.
     *
     * Not optional in spirit, but not `required` either: orders written before
     * #335 have no such field, and refusing to load them would turn a display
     * bug into a broken order history. `orderFormat.js` on the frontend falls
     * back for exactly those documents.
     */
    currency: {
      type: String,
      uppercase: true,
      trim: true,
      default: 'INR',
    },
    subtotal: { type: Number, required: true },
    /*
     * What a coupon took off, and which coupon did it.
     *
     * Recorded on the order rather than recomputed from the code at render
     * time, for the same reason `currency` is: the coupon can later be edited
     * or deactivated, and the order must keep saying what was actually
     * charged. Defaulted rather than `required` so orders written before #418
     * still load.
     */
    discount: { type: Number, required: true, default: 0, min: 0 },
    couponCode: { type: String, uppercase: true, trim: true, default: '' },
    tax: { type: Number, required: true, default: 0 },
    shipping: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'canceled', 'payment_failed'],
      default: 'pending',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'canceled'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      default: 'stripe',
    },
    stripePaymentIntentId: {
      type: String,
    },
    transactionId: {
      type: String,
    },
    receiptNumber: {
      type: String,
    },
    paidAt: {
      type: Date,
    },
    /*
     * Inventory is taken before the payment intent exists (see #297), so an
     * order that is still `pending` is holding stock it has not paid for.
     * Recording when that hold started makes the reservation a fact in the
     * database rather than an implicit side effect, which is what lets it be
     * swept when the customer never comes back. See #329.
     */
    reservedAt: {
      type: Date,
    },
    /*
     * Set when the hold has been handed back. `restoreInventory` is not
     * idempotent — it adds units unconditionally — so this marker is what
     * stops a second sweep restoring the same lines twice.
     */
    reservationReleasedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ userId: 1, createdAt: -1 });
// The sweeper's query: unreleased holds older than the TTL.
orderSchema.index({ paymentStatus: 1, reservationReleasedAt: 1, reservedAt: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });

const Order = mongoose.model('Order', orderSchema);

export default Order;
