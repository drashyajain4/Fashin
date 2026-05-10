const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    productId: String,
    name: String,
    category: String,
    price: Number,
    quantity: Number,
    size: String,
  },
  { _id: false }
);

const trackingPointSchema = new mongoose.Schema(
  {
    x: Number,
    y: Number,
  },
  { _id: false }
);

const trackingSchema = new mongoose.Schema(
  {
    city: String,
    riderName: String,
    riderPhone: String,
    riderId: String,
    originLabel: String,
    destinationLabel: String,
    routeStart: trackingPointSchema,
    routeEnd: trackingPointSchema,
    startedAt: Date,
    durationMinutes: Number,
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true },
    items: [orderItemSchema],
    subtotal: Number,
    discountAmount: { type: Number, default: 0 },
    deliveryCharge: { type: Number, default: 0 },
    total: { type: Number, required: true },
    promoCode: String,
    promoDescription: String,
    paymentMethod: { type: String, required: true },
    paymentLabel: String,
    paymentStatus: { type: String, default: 'Paid' },
    deliveryEta: String,
    shippingAddress: String,
    placedAt: { type: Date, default: Date.now },
    tracking: trackingSchema,
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    isAdmin: { type: Boolean, default: false },
    password: { type: String, required: true },
    orders: { type: [orderSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
