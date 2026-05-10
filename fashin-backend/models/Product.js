const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    price: { type: Number, required: true },
    description: { type: String, required: true, trim: true },
    image: { type: String, default: '' },
    images: { type: [String], default: [] },
    fit: { type: String, default: 'Tailored fit' },
    size: { type: String, default: 'S-XL' },
    deliveryTime: { type: String, default: '30 mins' },
    accent: { type: String, default: 'graphite' },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);
