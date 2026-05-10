const mongoose = require('mongoose');

const storeSettingsSchema = new mongoose.Schema(
  {
    storeName: { type: String, default: 'Fashin' },
    heroTagline: { type: String, default: '30 minute fashion delivery' },
    supportPhone: { type: String, default: '+91 98765 43210' },
    supportEmail: { type: String, default: 'support@fashin.in' },
    storeAddress: { type: String, default: 'Mahesh Nagar, Jaipur' },
    upiId: { type: String, default: 'fashin@upi' },
    razorpayKeyId: { type: String, default: '' },
    upiDiscountText: { type: String, default: 'Extra 10% off on UPI payments' },
    cardDiscountText: { type: String, default: 'Save 5% with debit or credit cards' },
    deliveryPromise: { type: String, default: 'Delivery in 30 mins across select city zones' },
    deliveryRadius: { type: String, default: '8 km express radius' },
    announcement: { type: String, default: 'Fresh monochrome drops every hour.' },
    availableBanks: { type: [String], default: ['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra Bank'] },
  },
  { timestamps: true }
);

module.exports = mongoose.models.StoreSettings || mongoose.model('StoreSettings', storeSettingsSchema);
