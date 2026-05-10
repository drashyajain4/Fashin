require('dotenv').config();
const express = require('express');
const fs = require('fs');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const Razorpay = require('razorpay');
const axios = require('axios');

const Product = require('./models/Product');
const PromoCode = require('./models/PromoCode');
const StoreSettings = require('./models/StoreSettings');
const User = require('./models/User');
const createAuthRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'fashin-dev-secret';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/fashin';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const rawGoogleMapsApiKey = (process.env.GOOGLE_MAPS_API_KEY || process.env.MAPS_API_KEY || '').trim();
const GOOGLE_MAPS_API_KEY = /^your_|^replace_/i.test(rawGoogleMapsApiKey) ? '' : rawGoogleMapsApiKey;
const uploadsDir = path.join(__dirname, 'uploads');

const paymentBanks = ['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra Bank'];
const supportedPaymentMethods = ['Razorpay Checkout', 'UPI', 'Debit Card', 'Credit Card'];
const deliveryFreeThreshold = 599;

const indiaDeliveryPoints = {
  Jaipur: { x: 39, y: 42 },
  Delhi: { x: 43, y: 28 },
  Chandigarh: { x: 41, y: 22 },
  Lucknow: { x: 55, y: 34 },
  Ahmedabad: { x: 30, y: 47 },
  Mumbai: { x: 26, y: 62 },
  Pune: { x: 30, y: 68 },
  Surat: { x: 28, y: 56 },
  Hyderabad: { x: 48, y: 68 },
  Bengaluru: { x: 43, y: 83 },
  Chennai: { x: 55, y: 86 },
  Kolkata: { x: 72, y: 46 },
};

const seedPromoCodes = [
  {
    code: 'FASHIN10',
    description: '10% off on your first fashion order',
    visibility: 'public',
    discountType: 'percent',
    discountValue: 10,
    minOrderValue: 999,
    maxDiscount: 500,
    active: true,
  },
  {
    code: 'RUNWAY200',
    description: 'Flat Rs 200 off above Rs 1999',
    visibility: 'public',
    discountType: 'flat',
    discountValue: 200,
    minOrderValue: 1999,
    maxDiscount: 0,
    active: true,
  },
];

const seedProducts = [
  {
    _id: 'studio-blazer',
    name: 'Studio Dash Blazer',
    category: 'Blazers',
    price: 3890,
    description: 'Sharp monochrome tailoring for same-evening plans.',
    image: '',
    fit: 'Relaxed structured fit',
    size: 'XS-XL',
    deliveryTime: '30 mins',
    accent: 'graphite',
  },
  {
    _id: 'metro-kurta',
    name: 'Metro White Kurta Set',
    category: 'Ethnic',
    price: 2490,
    description: 'Minimal white set with clean piping and effortless drape.',
    image: '',
    fit: 'Comfort straight fit',
    size: 'S-XXL',
    deliveryTime: '28 mins',
    accent: 'silver',
  },
  {
    _id: 'runway-shirt',
    name: 'Runway Linen Shirt',
    category: 'Shirts',
    price: 1690,
    description: 'Airy linen shirt for workdays, brunches and airport looks.',
    image: '',
    fit: 'Relaxed fit',
    size: 'S-XL',
    deliveryTime: '22 mins',
    accent: 'pearl',
  },
  {
    _id: 'tailored-dress',
    name: 'Tailored Column Dress',
    category: 'Dresses',
    price: 3190,
    description: 'A clean silhouette with an elevated monochrome finish.',
    image: '',
    fit: 'Body-skimming fit',
    size: 'XS-L',
    deliveryTime: '26 mins',
    accent: 'charcoal',
  },
  {
    _id: 'street-cargo',
    name: 'Street Cargo Trousers',
    category: 'Bottoms',
    price: 1990,
    description: 'Utility-inspired trousers with a polished city cut.',
    image: '',
    fit: 'Tapered cargo fit',
    size: '28-36',
    deliveryTime: '18 mins',
    accent: 'slate',
  },
  {
    _id: 'mono-polo',
    name: 'Mono Knit Polo',
    category: 'Polos',
    price: 1490,
    description: 'Dense knit polo with crisp collar and premium finish.',
    image: '',
    fit: 'Slim fit',
    size: 'S-XL',
    deliveryTime: '20 mins',
    accent: 'obsidian',
  },
  {
    _id: 'drape-saree',
    name: 'Graphite Drape Saree',
    category: 'Occasion',
    price: 4590,
    description: 'Modern ready-to-style saree for fast festive dressing.',
    image: '',
    fit: 'Pre-draped silhouette',
    size: 'Free size',
    deliveryTime: '30 mins',
    accent: 'smoke',
  },
  {
    _id: 'essential-tee',
    name: 'Essential Heavy Tee',
    category: 'Tops',
    price: 990,
    description: 'Premium everyday tee built for layering and clean lines.',
    image: '',
    fit: 'Boxy fit',
    size: 'S-XXL',
    deliveryTime: '16 mins',
    accent: 'ash',
  },
];

const memoryUsers = [];
let memoryProducts = seedProducts.map((product) => ({ ...product }));
let memoryStoreSettings = {
  storeName: 'Fashin',
  heroTagline: '30 minute fashion delivery',
  supportPhone: '9079142712',
  supportEmail: 'drashyajain4@gmail.com',
  storeAddress: 'Mahesh Nagar, Jaipur',
  upiId: 'fashin@upi',
  razorpayKeyId: '',
  upiDiscountText: 'Extra 10% off on UPI payments',
  cardDiscountText: 'Save 5% with debit or credit cards',
  deliveryPromise: 'Delivery in 30 mins across select city zones',
  deliveryRadius: '8 km express radius',
  announcement: 'Fresh monochrome drops every hour.',
  availableBanks: [...paymentBanks],
};
let memoryPromoCodes = seedPromoCodes.map((promo) => ({ ...promo }));
let dbConnected = false;

fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadsDir),
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    callback(null, `fashin-${Date.now()}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

app.use(
  '/api/auth',
  createAuthRoutes({
    User,
    jwtSecret: JWT_SECRET,
    isDbConnected: () => dbConnected,
    memoryUsers,
    findUserByEmail,
    getAdminBootstrapInfo: async (email) => {
      const normalizedEmail = email.toLowerCase().trim();
      const matchesAdminEmail = ADMIN_EMAIL && normalizedEmail === ADMIN_EMAIL;

      if (matchesAdminEmail) {
        return { isAdmin: true };
      }

      if (dbConnected) {
        const userCount = await User.countDocuments();
        return { isAdmin: userCount === 0 };
      }

      return { isAdmin: memoryUsers.length === 0 };
    },
  })
);

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    dbConnected = true;
    console.log('MongoDB connected');
  })
  .catch((error) => {
    console.log('MongoDB unavailable, using in-memory fallback.');
    console.log(error.message);
  });

function sanitizeUser(user) {
  return {
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    address: user.address || '',
    isAdmin: Boolean(user.isAdmin),
  };
}

function sanitizePromoCode(promoCode, includeAdminFields = false) {
  const payload = {
    code: promoCode.code,
    description: promoCode.description,
    visibility: promoCode.visibility || 'public',
    discountType: promoCode.discountType,
    discountValue: promoCode.discountValue,
    minOrderValue: promoCode.minOrderValue || 0,
    maxDiscount: promoCode.maxDiscount || 0,
  };

  if (includeAdminFields) {
    payload.active = Boolean(promoCode.active);
  }

  return payload;
}

function normalizePromoCodePayload(body) {
  return {
    code: String(body.code || '').trim().toUpperCase(),
    description: String(body.description || '').trim(),
    visibility: body.visibility === 'private' ? 'private' : 'public',
    discountType: body.discountType === 'flat' ? 'flat' : 'percent',
    discountValue: Number(body.discountValue || 0),
    minOrderValue: Number(body.minOrderValue || 0),
    maxDiscount: Number(body.maxDiscount || 0),
    active: body.active !== false,
  };
}

function detectDeliveryCity(address = '') {
  const normalizedAddress = address.toLowerCase();
  const knownCities = Object.keys(indiaDeliveryPoints);
  const matchedCity = knownCities.find((city) => normalizedAddress.includes(city.toLowerCase()));
  return matchedCity || 'Jaipur';
}

function createTrackingPayload(orderId, shippingAddress = '') {
  const city = detectDeliveryCity(shippingAddress);
  const routeStart = indiaDeliveryPoints.Jaipur;
  const routeEnd = city === 'Jaipur'
    ? { x: routeStart.x + 3, y: routeStart.y + 8 }
    : indiaDeliveryPoints[city] || indiaDeliveryPoints.Jaipur;

  return {
    city,
    riderName: 'Ravi Kumar',
    riderPhone: '9087654321',
    riderId: `RID-${orderId.slice(-4)}`,
    originLabel: 'Fashin Jaipur hub',
    destinationLabel: shippingAddress || `${city} delivery zone`,
    routeStart,
    routeEnd,
    startedAt: new Date().toISOString(),
    durationMinutes: 30,
  };
}

function getTrackingSnapshot(tracking) {
  if (!tracking) {
    return null;
  }

  const startMs = new Date(tracking.startedAt).getTime();
  const durationMs = Math.max(1, Number(tracking.durationMinutes || 30)) * 60 * 1000;
  const progress = Math.max(0, Math.min(1, (Date.now() - startMs) / durationMs));
  const currentLocation = {
    x: Number((tracking.routeStart.x + ((tracking.routeEnd.x - tracking.routeStart.x) * progress)).toFixed(2)),
    y: Number((tracking.routeStart.y + ((tracking.routeEnd.y - tracking.routeStart.y) * progress)).toFixed(2)),
  };

  let status = 'Order confirmed';
  if (progress >= 1) status = 'Delivered';
  else if (progress >= 0.82) status = 'Rider is arriving now';
  else if (progress >= 0.55) status = 'Rider is near your area';
  else if (progress >= 0.2) status = 'Rider is on the way';

  return {
    ...tracking,
    status,
    progress: Number((progress * 100).toFixed(1)),
    etaMinutes: Math.max(0, Math.ceil((durationMs - (Date.now() - startMs)) / 60000)),
    currentLocation,
  };
}

function calculatePromoDiscount(promoCode, subtotal) {
  if (!promoCode || !promoCode.active) {
    return { valid: false, message: 'Promo code is inactive.' };
  }

  if (subtotal < (promoCode.minOrderValue || 0)) {
    return {
      valid: false,
      message: `This promo code requires a minimum order of Rs ${promoCode.minOrderValue}.`,
    };
  }

  const rawDiscount = promoCode.discountType === 'flat'
    ? promoCode.discountValue
    : Math.round((subtotal * promoCode.discountValue) / 100);
  const maxDiscount = promoCode.maxDiscount || 0;
  const discountAmount = maxDiscount > 0 ? Math.min(rawDiscount, maxDiscount) : rawDiscount;

  return {
    valid: true,
    discountAmount: Math.max(0, Math.min(discountAmount, subtotal)),
  };
}

function serializeOrder(order) {
  const plainOrder = typeof order?.toObject === 'function' ? order.toObject() : order;
  return {
    ...plainOrder,
    trackingSnapshot: getTrackingSnapshot(plainOrder?.tracking),
  };
}

function formatGoogleAddressComponent(addressComponents = [], types = []) {
  const component = addressComponents.find((item) => types.some((type) => item.types?.includes(type)));
  return component?.longText || component?.long_name || '';
}

function normalizeGooglePlace(place = {}) {
  const addressComponents = place.addressComponents || place.address_components || [];
  return {
    provider: 'google',
    placeId: place.id || place.place_id || '',
    name: place.displayName?.text || place.name || place.formattedAddress || place.formatted_address || 'Address match',
    address: place.formattedAddress || place.formatted_address || '',
    city: formatGoogleAddressComponent(addressComponents, ['locality', 'postal_town', 'administrative_area_level_3']) || 'Jaipur',
    lat: place.location?.latitude ?? place.geometry?.location?.lat,
    lon: place.location?.longitude ?? place.geometry?.location?.lng,
  };
}

function normalizeOsmPlace(place = {}) {
  const address = place.address || {};
  return {
    provider: 'openstreetmap',
    placeId: String(place.place_id || ''),
    name: place.name || address.road || address.suburb || address.neighbourhood || 'Address match',
    address: place.display_name || '',
    city: address.city || address.town || address.village || address.county || address.state_district || 'Jaipur',
    lat: Number(place.lat),
    lon: Number(place.lon),
  };
}

async function getOsmSuggestions(keyword, city) {
  const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
    params: {
      format: 'json',
      addressdetails: 1,
      limit: 6,
      countrycodes: 'in',
      q: `${keyword}, ${city}, India`,
    },
    headers: {
      'Accept-Language': 'en-IN,en;q=0.9',
      'User-Agent': 'Fashin/1.0 location picker',
    },
    timeout: 8000,
  });

  return Array.isArray(data) ? data.map(normalizeOsmPlace) : [];
}

async function getOsmReverse(lat, lon) {
  const { data } = await axios.get('https://nominatim.openstreetmap.org/reverse', {
    params: {
      format: 'json',
      addressdetails: 1,
      lat,
      lon,
    },
    headers: {
      'Accept-Language': 'en-IN,en;q=0.9',
      'User-Agent': 'Fashin/1.0 location picker',
    },
    timeout: 8000,
  });

  return normalizeOsmPlace(data);
}

async function getGoogleSuggestions(keyword, city) {
  const { data } = await axios.post(
    'https://places.googleapis.com/v1/places:autocomplete',
    {
      input: `${keyword}, ${city}`,
      includedRegionCodes: ['in'],
      languageCode: 'en-IN',
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
      },
      timeout: 8000,
    }
  );

  return (data.suggestions || [])
    .map((suggestion) => suggestion.placePrediction)
    .filter(Boolean)
    .map((prediction) => ({
      provider: 'google',
      placeId: prediction.placeId,
      name: prediction.structuredFormat?.mainText?.text || prediction.text?.text || 'Address match',
      address: prediction.text?.text || '',
      city,
    }));
}

async function getGooglePlaceDetails(placeId) {
  const { data } = await axios.get(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: {
      'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,addressComponents',
    },
    timeout: 8000,
  });

  return normalizeGooglePlace(data);
}

async function getGoogleReverse(lat, lon) {
  const { data } = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
    params: {
      latlng: `${lat},${lon}`,
      key: GOOGLE_MAPS_API_KEY,
      language: 'en-IN',
      region: 'in',
    },
    timeout: 8000,
  });

  if (data.status !== 'OK' || !data.results?.length) {
    throw new Error(data.error_message || 'Google Maps could not find this address.');
  }

  return normalizeGooglePlace(data.results[0]);
}

function upsertMemoryPromoCode(promoCode) {
  const normalizedPromoCode = {
    ...promoCode,
    code: String(promoCode.code || '').trim().toUpperCase(),
  };
  const existingIndex = memoryPromoCodes.findIndex((entry) => entry.code === normalizedPromoCode.code);

  if (existingIndex >= 0) {
    memoryPromoCodes[existingIndex] = { ...memoryPromoCodes[existingIndex], ...normalizedPromoCode };
    return memoryPromoCodes[existingIndex];
  }

  memoryPromoCodes = [normalizedPromoCode, ...memoryPromoCodes];
  return normalizedPromoCode;
}

function mergePromoCodeLists(primaryList = [], secondaryList = []) {
  const merged = new Map();

  secondaryList.forEach((promoCode) => {
    merged.set(String(promoCode.code || '').trim().toUpperCase(), promoCode);
  });

  primaryList.forEach((promoCode) => {
    merged.set(String(promoCode.code || '').trim().toUpperCase(), promoCode);
  });

  return [...merged.values()];
}

async function syncMemoryPromoCodesToDb() {
  if (!dbConnected || !memoryPromoCodes.length) {
    return;
  }

  const dbPromoCodes = await PromoCode.find().lean();
  const dbCodes = new Set(dbPromoCodes.map((promoCode) => promoCode.code));
  const missingPromoCodes = memoryPromoCodes.filter((promoCode) => !dbCodes.has(promoCode.code));

  if (missingPromoCodes.length) {
    await PromoCode.insertMany(missingPromoCodes, { ordered: false });
  }
}

async function findPromoCodeByCode(code, includeInactive = true) {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode) {
    return null;
  }

  const memoryPromoCode = memoryPromoCodes.find((entry) => entry.code === normalizedCode) || null;
  if (memoryPromoCode && (includeInactive || memoryPromoCode.active)) {
    return memoryPromoCode;
  }

  if (!dbConnected) {
    return null;
  }

  const query = includeInactive
    ? PromoCode.findOne({ code: normalizedCode })
    : PromoCode.findOne({ code: normalizedCode, active: true });
  const promoCode = await query.lean();

  if (promoCode) {
    upsertMemoryPromoCode(promoCode);
  }

  return promoCode;
}

async function ensurePromoCodes() {
  if (!dbConnected) {
    return memoryPromoCodes;
  }

  await syncMemoryPromoCodesToDb();
  const existingPromoCodes = await PromoCode.find().lean();
  if (existingPromoCodes.length > 0) {
    const mergedPromoCodes = mergePromoCodeLists(existingPromoCodes, memoryPromoCodes);
    memoryPromoCodes = mergedPromoCodes.map((promoCode) => ({ ...promoCode }));
    return mergedPromoCodes;
  }

  await PromoCode.insertMany(seedPromoCodes);
  const seededPromoCodes = await PromoCode.find().lean();
  memoryPromoCodes = mergePromoCodeLists(seededPromoCodes, memoryPromoCodes).map((promoCode) => ({ ...promoCode }));
  return memoryPromoCodes;
}

function hasForcedAdminAccess(email) {
  return Boolean(ADMIN_EMAIL) && email.toLowerCase().trim() === ADMIN_EMAIL;
}

async function syncAdminAccess(user, lean = false) {
  if (!user || user.isAdmin || !hasForcedAdminAccess(user.email)) {
    return user;
  }

  if (!dbConnected) {
    user.isAdmin = true;
    return user;
  }

  if (lean) {
    await User.updateOne({ _id: user._id }, { $set: { isAdmin: true } });
    return { ...user, isAdmin: true };
  }

  user.isAdmin = true;
  await user.save();
  return user;
}

async function findUserByEmail(email, lean = false) {
  const normalizedEmail = email.toLowerCase().trim();

  if (dbConnected) {
    const query = User.findOne({ email: normalizedEmail });
    const user = lean ? await query.lean() : await query;
    return syncAdminAccess(user, lean);
  }

  const user = memoryUsers.find((entry) => entry.email === normalizedEmail) || null;
  return syncAdminAccess(user, lean);
}

async function ensureProducts() {
  if (!dbConnected) {
    return memoryProducts;
  }

  const existingProducts = await Product.find().lean();
  if (existingProducts.length > 0) {
    return existingProducts;
  }

  await Product.insertMany(
    seedProducts.map(({ _id, ...product }) => ({
      ...product,
    }))
  );

  return Product.find().lean();
}

async function ensureStoreSettings() {
  if (!dbConnected) {
    return memoryStoreSettings;
  }

  let settings = await StoreSettings.findOne().lean();
  if (settings) {
    return settings;
  }

  settings = await StoreSettings.create(memoryStoreSettings);
  return settings.toObject();
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing authentication token.' });
  }

  const token = authHeader.slice(7);

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid authentication token.' });
  }
}

function authenticateOptional(req, _res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return next();
  }

  try {
    req.user = jwt.verify(authHeader.slice(7), JWT_SECRET);
  } catch (error) {
    req.user = null;
  }

  return next();
}

async function requireAdmin(req, res, next) {
  try {
    const user = await findUserByEmail(req.user.email);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (!user.isAdmin) {
      return res.status(403).json({ message: 'Admin access is required for this action.' });
    }

    req.currentUser = user;
    return next();
  } catch (error) {
    return res.status(500).json({ message: 'Unable to verify admin permissions right now.' });
  }
}

function normalizeProductPayload(body) {
  const images = Array.isArray(body.images)
    ? body.images.map((item) => String(item || '').trim()).filter(Boolean)
    : String(body.imagesText || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  const primaryImage = body.image || images[0] || '';

  return {
    name: body.name,
    category: body.category,
    price: Number(body.price),
    description: body.description,
    image: primaryImage,
    images: images.length ? images : (primaryImage ? [primaryImage] : []),
    fit: body.fit || 'Tailored fit',
    size: body.size || 'S-XL',
    deliveryTime: body.deliveryTime || '30 mins',
    accent: body.accent || 'graphite',
  };
}

app.get('/api/location/suggestions', async (req, res) => {
  const keyword = String(req.query.keyword || '').trim();
  const city = String(req.query.city || 'Jaipur').trim();

  if (keyword.length < 3) {
    return res.json({ provider: GOOGLE_MAPS_API_KEY ? 'google' : 'openstreetmap', suggestions: [] });
  }

  try {
    const suggestions = GOOGLE_MAPS_API_KEY
      ? await getGoogleSuggestions(keyword, city)
      : await getOsmSuggestions(keyword, city);

    return res.json({
      provider: GOOGLE_MAPS_API_KEY ? 'google' : 'openstreetmap',
      suggestions,
    });
  } catch (error) {
    try {
      const suggestions = await getOsmSuggestions(keyword, city);
      return res.json({ provider: 'openstreetmap', suggestions, fallback: true });
    } catch {
      return res.status(502).json({ message: error.message || 'Unable to fetch address suggestions right now.' });
    }
  }
});

app.get('/api/location/place/:placeId', async (req, res) => {
  if (!GOOGLE_MAPS_API_KEY) {
    return res.status(400).json({ message: 'Google Maps API key is not configured.' });
  }

  try {
    const place = await getGooglePlaceDetails(req.params.placeId);
    return res.json({ provider: 'google', place });
  } catch (error) {
    return res.status(502).json({ message: error.message || 'Unable to fetch this address from Google Maps.' });
  }
});

app.get('/api/location/reverse', async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ message: 'Valid latitude and longitude are required.' });
  }

  try {
    const place = GOOGLE_MAPS_API_KEY
      ? await getGoogleReverse(lat, lon)
      : await getOsmReverse(lat, lon);

    return res.json({
      provider: GOOGLE_MAPS_API_KEY ? 'google' : 'openstreetmap',
      place,
    });
  } catch (error) {
    try {
      const place = await getOsmReverse(lat, lon);
      return res.json({ provider: 'openstreetmap', place, fallback: true });
    } catch {
      return res.status(502).json({ message: error.message || 'Unable to detect this address right now.' });
    }
  }
});

app.get('/api/location/static-map', async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);

  if (!GOOGLE_MAPS_API_KEY) {
    return res.status(404).json({ message: 'Google Maps API key is not configured.' });
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ message: 'Valid latitude and longitude are required.' });
  }

  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/staticmap', {
      params: {
        center: `${lat},${lon}`,
        zoom: 16,
        size: '640x360',
        scale: 2,
        maptype: 'roadmap',
        markers: `color:black|label:F|${lat},${lon}`,
        key: GOOGLE_MAPS_API_KEY,
      },
      responseType: 'arraybuffer',
      timeout: 8000,
    });

    res.set('Content-Type', response.headers['content-type'] || 'image/png');
    res.set('Cache-Control', 'public, max-age=300');
    return res.send(Buffer.from(response.data));
  } catch (error) {
    return res.status(502).json({ message: error.message || 'Unable to load Google map preview.' });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const products = await ensureProducts();
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Unable to fetch products right now.' });
  }
});

app.get('/api/promocodes', authenticateOptional, async (req, res) => {
  try {
    const promoCodes = await ensurePromoCodes();
    let includeAdminFields = false;

    if (req.user?.email) {
      const currentUser = await findUserByEmail(req.user.email, true);
      includeAdminFields = Boolean(currentUser?.isAdmin);
    }

    const visiblePromoCodes = includeAdminFields
      ? promoCodes
      : promoCodes.filter((promoCode) => promoCode.active && (promoCode.visibility || 'public') !== 'private');

    return res.json(visiblePromoCodes.map((promoCode) => sanitizePromoCode(promoCode, includeAdminFields)));
  } catch (error) {
    return res.status(500).json({ message: 'Unable to fetch promo codes right now.' });
  }
});

app.post('/api/promocodes/validate', async (req, res) => {
  try {
    const promoCode = await findPromoCodeByCode(req.body.code, false);
    if (!promoCode) {
      return res.status(404).json({ message: 'Promo code not found.' });
    }

    const subtotal = Number(req.body.subtotal || 0);
    const validation = calculatePromoDiscount(promoCode, subtotal);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }

    return res.json({
      ...sanitizePromoCode(promoCode),
      discountAmount: validation.discountAmount,
      subtotal,
      subtotalAfterDiscount: Math.max(0, subtotal - validation.discountAmount),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to validate promo code right now.' });
  }
});

app.post('/api/promocodes', authenticate, requireAdmin, async (req, res) => {
  try {
    const promoPayload = normalizePromoCodePayload(req.body);
    if (!promoPayload.code || !promoPayload.description || promoPayload.discountValue <= 0) {
      return res.status(400).json({ message: 'Code, description and discount value are required.' });
    }

    if (!dbConnected) {
      return res.status(201).json(upsertMemoryPromoCode(promoPayload));
    }

    const savedPromoCode = await PromoCode.findOneAndUpdate(
      { code: promoPayload.code },
      promoPayload,
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    const savedPromoCodeObject = typeof savedPromoCode?.toObject === 'function' ? savedPromoCode.toObject() : savedPromoCode;
    upsertMemoryPromoCode(savedPromoCodeObject);
    return res.status(201).json(savedPromoCodeObject);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to save promo code right now.' });
  }
});

app.delete('/api/promocodes/:code', authenticate, requireAdmin, async (req, res) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    if (!code) {
      return res.status(400).json({ message: 'Promo code is required.' });
    }

    if (!dbConnected) {
      const existingPromoCode = memoryPromoCodes.find((promoCode) => promoCode.code === code);
      if (!existingPromoCode) {
        return res.status(404).json({ message: 'Promo code not found.' });
      }

      memoryPromoCodes = memoryPromoCodes.filter((promoCode) => promoCode.code !== code);
      return res.json({ success: true });
    }

    const deletedPromoCode = await PromoCode.findOneAndDelete({ code });
    if (!deletedPromoCode) {
      return res.status(404).json({ message: 'Promo code not found.' });
    }

    memoryPromoCodes = memoryPromoCodes.filter((promoCode) => promoCode.code !== code);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to delete promo code right now.' });
  }
});

app.post('/api/uploads', authenticate, requireAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please attach an image file.' });
    }

    return res.status(201).json({
      url: `/uploads/${req.file.filename}`,
      filename: req.file.filename,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to upload image right now.' });
  }
});

app.post('/api/products', authenticate, requireAdmin, async (req, res) => {
  try {
    const productPayload = normalizeProductPayload(req.body);

    if (!productPayload.name || !productPayload.category || !productPayload.description || !productPayload.price) {
      return res.status(400).json({ message: 'Name, category, price and description are required.' });
    }

    if (!dbConnected) {
      const memoryProduct = {
        ...productPayload,
        _id: `memory-${Date.now()}`,
      };
      memoryProducts = [memoryProduct, ...memoryProducts];
      return res.status(201).json(memoryProduct);
    }

    const product = new Product(productPayload);
    await product.save();
    return res.status(201).json(product);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to create product right now.' });
  }
});

app.put('/api/products/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const productPayload = normalizeProductPayload(req.body);
    if (!productPayload.name || !productPayload.category || !productPayload.description || !productPayload.price) {
      return res.status(400).json({ message: 'Name, category, price and description are required.' });
    }

    if (!dbConnected) {
      const index = memoryProducts.findIndex((product) => product._id === req.params.id);
      if (index === -1) {
        return res.status(404).json({ message: 'Product not found.' });
      }

      memoryProducts[index] = { ...memoryProducts[index], ...productPayload };
      return res.json(memoryProducts[index]);
    }

    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, productPayload, { new: true, runValidators: true });
    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    return res.json(updatedProduct);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to update product right now.' });
  }
});

app.delete('/api/products/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    if (!dbConnected) {
      const existingProduct = memoryProducts.find((product) => product._id === req.params.id);
      if (!existingProduct) {
        return res.status(404).json({ message: 'Product not found.' });
      }

      memoryProducts = memoryProducts.filter((product) => product._id !== req.params.id);
      return res.json({ success: true });
    }

    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to delete product right now.' });
  }
});

app.get('/api/store', async (req, res) => {
  try {
    const storeSettings = await ensureStoreSettings();
    return res.json(storeSettings);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to fetch store settings right now.' });
  }
});

app.post('/api/store', authenticate, requireAdmin, async (req, res) => {
  try {
    const incomingSettings = {
      storeName: req.body.storeName || 'Fashin',
      heroTagline: req.body.heroTagline || '30 minute fashion delivery',
      supportPhone: req.body.supportPhone || '9079142712',
      supportEmail: req.body.supportEmail || 'drashyajain4@gmail.com',
      storeAddress: req.body.storeAddress || 'Mahesh Nagar, Jaipur',
      upiId: req.body.upiId || 'fashin@upi',
      razorpayKeyId: req.body.razorpayKeyId || '',
      upiDiscountText: req.body.upiDiscountText || 'Extra 10% off on UPI payments',
      cardDiscountText: req.body.cardDiscountText || 'Save 5% with debit or credit cards',
      deliveryPromise: req.body.deliveryPromise || 'Delivery in 30 mins across select city zones',
      deliveryRadius: req.body.deliveryRadius || '8 km express radius',
      announcement: req.body.announcement || 'Fresh monochrome drops every hour.',
      availableBanks: Array.isArray(req.body.availableBanks) && req.body.availableBanks.length > 0
        ? req.body.availableBanks
        : [...paymentBanks],
    };

    if (!dbConnected) {
      memoryStoreSettings = incomingSettings;
      return res.json(memoryStoreSettings);
    }

    const existingSettings = await StoreSettings.findOne();
    if (!existingSettings) {
      const createdSettings = await StoreSettings.create(incomingSettings);
      return res.json(createdSettings);
    }

    Object.assign(existingSettings, incomingSettings);
    await existingSettings.save();
    return res.json(existingSettings);
  } catch (error) {
    return res.status(500).json({ message: 'Unable to save store settings right now.' });
  }
});

app.get('/api/orders', authenticate, async (req, res) => {
  try {
    const user = await findUserByEmail(req.user.email, true);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.json({
      user: sanitizeUser(user),
      orders: [...(user.orders || [])]
        .sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt))
        .map((order) => serializeOrder(order)),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to fetch order history right now.' });
  }
});

app.post('/api/orders', authenticate, async (req, res) => {
  try {
    const shippingAddress = req.body.shippingAddress || '';
    const subtotal = Number(req.body.subtotal || 0);
    const discountAmount = Number(req.body.discountAmount || 0);
    const deliveryCharge = Number(req.body.deliveryCharge || 0);
    const orderId = `FSH-${Date.now()}`;
    const order = {
      orderId,
      items: req.body.items || [],
      subtotal,
      discountAmount,
      deliveryCharge,
      total: Number(req.body.total || 0),
      promoCode: req.body.promoCode || '',
      promoDescription: req.body.promoDescription || '',
      paymentMethod: req.body.paymentMethod || 'Razorpay Checkout',
      paymentLabel: req.body.paymentLabel || req.body.paymentMethod || 'Razorpay Checkout',
      paymentStatus: req.body.paymentStatus || 'Paid',
      deliveryEta: req.body.deliveryEta || 'Arriving in 30 mins',
      shippingAddress,
      placedAt: new Date().toISOString(),
      tracking: createTrackingPayload(orderId, shippingAddress),
    };

    const user = await findUserByEmail(req.user.email);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    user.orders = user.orders || [];
    user.orders.unshift(order);
    if (shippingAddress && !user.address) {
      user.address = shippingAddress;
    }

    if (dbConnected) {
      await user.save();
    }

    return res.status(201).json({
      order: serializeOrder(order),
      orders: user.orders.map((entry) => serializeOrder(entry)),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to save order right now.' });
  }
});

app.get('/api/orders/:orderId/tracking', authenticate, async (req, res) => {
  try {
    const user = await findUserByEmail(req.user.email, true);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const order = (user.orders || []).find((entry) => entry.orderId === req.params.orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    const trackingSnapshot = getTrackingSnapshot(order.tracking);
    return res.json({
      orderId: order.orderId,
      shippingAddress: order.shippingAddress || '',
      tracking: trackingSnapshot,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to fetch rider tracking right now.' });
  }
});

app.post('/api/payment/razorpay', async (req, res) => {
  try {
    const { amount = 0 } = req.body;
    const storeSettings = await ensureStoreSettings();
    const hasLiveKeys =
      process.env.RAZORPAY_KEY &&
      process.env.RAZORPAY_SECRET &&
      process.env.RAZORPAY_KEY !== 'your_key_here' &&
      process.env.RAZORPAY_SECRET !== 'your_secret_here';

    if (!hasLiveKeys) {
      return res.json({
        mode: 'demo',
        amount,
        currency: 'INR',
        paymentBanks: storeSettings.availableBanks || paymentBanks,
        supportedPaymentMethods,
        key: storeSettings.razorpayKeyId || '',
        upiId: storeSettings.upiId || 'fashin@upi',
      });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY,
      key_secret: process.env.RAZORPAY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `fashin_${Date.now()}`,
      notes: {
        service: '30 minute fashion delivery',
      },
    });

    return res.json({
      mode: 'live',
      key: process.env.RAZORPAY_KEY,
      order,
      paymentBanks: storeSettings.availableBanks || paymentBanks,
      supportedPaymentMethods,
      upiId: storeSettings.upiId || 'fashin@upi',
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to initialize payment right now.' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
