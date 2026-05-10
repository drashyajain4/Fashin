import { startTransition, useDeferredValue, useEffect, useState } from 'react';
import './App.css';
import fashinLogo from './assets/fashin-logo.png';

const API = 'http://localhost:5000';
const STORAGE = {
  cart: 'fashin-cart',
  deliveryBuilding: 'fashin-delivery-building',
  deliveryCity: 'fashin-delivery-city',
  deliveryLocation: 'fashin-delivery-location',
  deliveryLocationCoords: 'fashin-delivery-location-coords',
  token: 'fashin-token',
  user: 'fashin-user',
};
const CART_HASH = '#cart';
const ACCOUNT_HASH = '#account';
const defaultDeliveryCoords = { lat: 26.9124, lon: 75.7873 };

const productsFallback = [
  { _id: 'studio-blazer', name: 'Studio Dash Blazer', category: 'Blazers', price: 3890, description: 'Sharp monochrome tailoring for same-evening plans.', fit: 'Relaxed structured fit', size: 'XS-XL', deliveryTime: '30 mins', accent: 'graphite' },
  { _id: 'metro-kurta', name: 'Metro White Kurta Set', category: 'Ethnic', price: 2490, description: 'Minimal white set with clean piping and effortless drape.', fit: 'Comfort straight fit', size: 'S-XXL', deliveryTime: '28 mins', accent: 'silver' },
  { _id: 'runway-shirt', name: 'Runway Linen Shirt', category: 'Shirts', price: 1690, description: 'Airy linen shirt for workdays, brunches and airport looks.', fit: 'Relaxed fit', size: 'S-XL', deliveryTime: '22 mins', accent: 'pearl' },
  { _id: 'tailored-dress', name: 'Tailored Column Dress', category: 'Dresses', price: 3190, description: 'A clean silhouette with an elevated monochrome finish.', fit: 'Body-skimming fit', size: 'XS-L', deliveryTime: '26 mins', accent: 'charcoal' },
  { _id: 'street-cargo', name: 'Street Cargo Trousers', category: 'Bottoms', price: 1990, description: 'Utility-inspired trousers with a polished city cut.', fit: 'Tapered cargo fit', size: '28-36', deliveryTime: '18 mins', accent: 'slate' },
  { _id: 'mono-polo', name: 'Mono Knit Polo', category: 'Polos', price: 1490, description: 'Dense knit polo with crisp collar and premium finish.', fit: 'Slim fit', size: 'S-XL', deliveryTime: '20 mins', accent: 'obsidian' },
  { _id: 'drape-saree', name: 'Graphite Drape Saree', category: 'Occasion', price: 4590, description: 'Modern ready-to-style saree for fast festive dressing.', fit: 'Pre-draped silhouette', size: 'Free size', deliveryTime: '30 mins', accent: 'smoke' },
  { _id: 'essential-tee', name: 'Essential Heavy Tee', category: 'Tops', price: 990, description: 'Premium everyday tee built for layering and clean lines.', fit: 'Boxy fit', size: 'S-XXL', deliveryTime: '16 mins', accent: 'ash' },
];

const paymentOptions = ['Razorpay Checkout', 'UPI', 'Debit Card', 'Credit Card'];
const defaultBanks = ['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra Bank'];
const upiApps = ['Google Pay', 'PhonePe', 'Paytm', 'BHIM UPI'];

const defaultStore = {
  storeName: 'Fashin',
  heroTagline: '30 minute fashion delivery',
  supportPhone: '9079142712',
  supportEmail: 'support.fashin@gmail.com',
  storeAddress: 'Mahesh Nagar, Jaipur',
  upiId: 'fashin@upi',
  razorpayKeyId: '',
  upiDiscountText: 'Extra 10% off on UPI payments',
  cardDiscountText: 'Save 5% with debit or credit cards',
  deliveryPromise: 'Delivery in 30 mins across select city zones',
  deliveryRadius: '8 km express radius',
  announcement: 'Fresh monochrome drops every hour.',
  availableBanks: defaultBanks,
};

const initialProductForm = {
  name: '',
  category: '',
  price: '',
  description: '',
  image: '',
  images: [],
  fit: '',
  size: '',
  deliveryTime: '30 mins',
  accent: 'graphite',
};

const initialPromoForm = {
  code: '',
  description: '',
  visibility: 'public',
  discountType: 'percent',
  discountValue: '10',
  minOrderValue: '599',
  maxDiscount: '500',
  active: true,
};

const indiaMapPath = 'M36 6 48 12 60 18 66 28 74 33 81 44 76 54 80 64 73 77 64 89 54 97 47 90 44 79 37 72 34 61 26 53 22 43 24 32 31 22 36 6Z';

const money = (value) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

const readJson = (key, fallback) => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const readApiBody = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  return {
    message: text.trim().startsWith('<!DOCTYPE')
      ? 'The backend returned an HTML error page. Restart the backend server and try again.'
      : (text.trim() || 'Unexpected server response.'),
  };
};

const ordersKey = (email) => `fashin-orders-${email}`;
const resolveImageSrc = (value) => {
  if (!value) return '';
  if (value.startsWith('http') || value.startsWith('data:') || value.startsWith('blob:')) return value;
  if (value.startsWith('/')) return `${API}${value}`;
  return value;
};

const scrollToSection = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
const formatMapAddress = (item) => item?.address || item?.display_name || [item?.name, item?.city].filter(Boolean).join(', ');
const resolveAddressCity = (item = {}) => item.city || item.address?.city || item.address?.town || item.address?.village || item.address?.county || item.address?.state_district || '';

const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector('script[data-razorpay-sdk="true"]');
    if (existing) return existing.addEventListener('load', () => resolve(true), { once: true });
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpaySdk = 'true';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

function App() {
  const [products, setProducts] = useState(productsFallback);
  const [store, setStore] = useState(defaultStore);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [cart, setCart] = useState(() => readJson(STORAGE.cart, []));
  const [cartOpen, setCartOpen] = useState(() => window.location.hash === CART_HASH);
  const [accountOpen, setAccountOpen] = useState(() => window.location.hash === ACCOUNT_HASH);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [accountTab, setAccountTab] = useState('profile');


  const [deliveryBuilding, setDeliveryBuilding] = useState(() => readJson(STORAGE.deliveryBuilding, ''));
  const [deliveryCity, setDeliveryCity] = useState(() => readJson(STORAGE.deliveryCity, 'Jaipur'));
  const [deliveryLocation, setDeliveryLocation] = useState(() => readJson(STORAGE.deliveryLocation, defaultStore.storeAddress));
  const [deliveryLocationCoords, setDeliveryLocationCoords] = useState(() => readJson(STORAGE.deliveryLocationCoords, defaultDeliveryCoords));
  const [deliveryBuildingDraft, setDeliveryBuildingDraft] = useState(() => readJson(STORAGE.deliveryBuilding, ''));
  const [deliveryCityDraft, setDeliveryCityDraft] = useState(() => readJson(STORAGE.deliveryCity, 'Jaipur'));
  const [deliveryLocationDraft, setDeliveryLocationDraft] = useState(() => readJson(STORAGE.deliveryLocation, defaultStore.storeAddress));
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationProvider, setLocationProvider] = useState('google');
  const [mapPreviewError, setMapPreviewError] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [token, setToken] = useState(() => window.localStorage.getItem(STORAGE.token) || '');
  const [user, setUser] = useState(() => readJson(STORAGE.user, null));

  const [editingPersonalInfo, setEditingPersonalInfo] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', gender: 'Male', email: '', phone: '' });

  useEffect(() => {
    if (user) {
      const parts = user.name ? user.name.split(' ') : [''];
      setProfileForm({
        firstName: parts[0] || '',
        lastName: parts.slice(1).join(' ') || '',
        gender: user.gender || 'Male',
        email: user.email || '',
        phone: user.phone || ''
      });
    }
  }, [user]);

  const handleSaveProfile = (section) => {
    const updatedUser = { ...user };
    if (section === 'personal') {
      updatedUser.name = `${profileForm.firstName} ${profileForm.lastName}`.trim();
      updatedUser.gender = profileForm.gender;
      setEditingPersonalInfo(false);
    } else if (section === 'email') {
      updatedUser.email = profileForm.email;
      setEditingEmail(false);
    } else if (section === 'phone') {
      updatedUser.phone = profileForm.phone;
      setEditingPhone(false);
    }
    setUser(updatedUser);
    window.localStorage.setItem('fashin_user', JSON.stringify(updatedUser));
  };
  const [orders, setOrders] = useState([]);
  const [authMode, setAuthMode] = useState('signup');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', phone: '', address: '' });
  const [storeForm, setStoreForm] = useState({ ...defaultStore, availableBanksText: defaultBanks.join(', ') });
  const [productForm, setProductForm] = useState(initialProductForm);
  const [activeProductImage, setActiveProductImage] = useState('');
  const [promoForm, setPromoForm] = useState(initialPromoForm);
  const [editingProductId, setEditingProductId] = useState('');
  const [promoCodes, setPromoCodes] = useState([]);
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [trackedOrderId, setTrackedOrderId] = useState('');
  const [trackingData, setTrackingData] = useState(null);
  const [authMessage, setAuthMessage] = useState('');
  const [checkoutMessage, setCheckoutMessage] = useState('');
  const [dashboardMessage, setDashboardMessage] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [payBusy, setPayBusy] = useState(false);
  const [storeBusy, setStoreBusy] = useState(false);
  const [productBusy, setProductBusy] = useState(false);
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoManageBusy, setPromoManageBusy] = useState(false);
  const [payMethod, setPayMethod] = useState('Razorpay Checkout');
  const [bank, setBank] = useState(defaultBanks[0]);
  const [upiApp, setUpiApp] = useState(upiApps[0]);
  const [avatarPhoto, setAvatarPhoto] = useState('');
  const [previewId, setPreviewId] = useState(productsFallback[0]._id);
  const [previewMessage, setPreviewMessage] = useState('Upload a photo and preview each selected product on your look board.');
  const [activeProductId, setActiveProductId] = useState('');
  const [productZoom, setProductZoom] = useState(1);
  const query = useDeferredValue(search);

  useEffect(() => {
    const syncPageFromUrl = () => {
      const isCartPage = window.location.hash === CART_HASH;
      const isAccountPage = window.location.hash === ACCOUNT_HASH;
      setCartOpen(isCartPage);
      setAccountOpen(isAccountPage);
      if (isCartPage || isAccountPage) {
        setActiveProductId('');
        setProductZoom(1);
        setActiveProductImage('');
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    };

    syncPageFromUrl();
    window.addEventListener('hashchange', syncPageFromUrl);
    return () => window.removeEventListener('hashchange', syncPageFromUrl);
  }, []);

  useEffect(() => {
    fetch(`${API}/api/products`).then((r) => (r.ok ? r.json() : Promise.reject())).then((data) => {
      if (Array.isArray(data) && data.length) {
        setProducts(data);
        setPreviewId(data[0]._id);
      }
    }).catch(() => { });

    fetch(`${API}/api/store`).then((r) => (r.ok ? r.json() : Promise.reject())).then((data) => {
      const nextStore = {
        ...defaultStore,
        ...data,
        availableBanks: Array.isArray(data.availableBanks) && data.availableBanks.length ? data.availableBanks : defaultBanks,
      };
      setStore(nextStore);
      setStoreForm({
        ...nextStore,
        availableBanksText: nextStore.availableBanks.join(', '),
      });
      setBank((currentBank) => (nextStore.availableBanks.includes(currentBank) ? currentBank : nextStore.availableBanks[0]));
    }).catch(() => { });
  }, []);

  useEffect(() => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${API}/api/promocodes`, { headers })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (Array.isArray(data)) {
          setPromoCodes(data);
        }
      })
      .catch(() => { });
  }, [token]);

  useEffect(() => { window.localStorage.setItem(STORAGE.cart, JSON.stringify(cart)); }, [cart]);
  useEffect(() => { window.localStorage.setItem(STORAGE.deliveryBuilding, JSON.stringify(deliveryBuilding)); }, [deliveryBuilding]);
  useEffect(() => { window.localStorage.setItem(STORAGE.deliveryCity, JSON.stringify(deliveryCity)); }, [deliveryCity]);
  useEffect(() => { window.localStorage.setItem(STORAGE.deliveryLocation, JSON.stringify(deliveryLocation)); }, [deliveryLocation]);
  useEffect(() => { window.localStorage.setItem(STORAGE.deliveryLocationCoords, JSON.stringify(deliveryLocationCoords)); }, [deliveryLocationCoords]);
  useEffect(() => { token ? window.localStorage.setItem(STORAGE.token, token) : window.localStorage.removeItem(STORAGE.token); }, [token]);
  useEffect(() => { user ? window.localStorage.setItem(STORAGE.user, JSON.stringify(user)) : window.localStorage.removeItem(STORAGE.user); }, [user]);

  useEffect(() => {
    const keyword = deliveryLocationDraft.trim();
    const city = deliveryCityDraft.trim();
    if (!locationOpen || keyword.length < 3 || !city) {
      setLocationSuggestions([]);
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setLocationBusy(true);
        const response = await fetch(`${API}/api/location/suggestions?keyword=${encodeURIComponent(keyword)}&city=${encodeURIComponent(city)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Address suggestions are not available right now.');
        const data = await response.json();
        const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
        setLocationProvider(data.provider || 'map');
        setLocationSuggestions(suggestions);
        setLocationMessage(suggestions.length ? `Choose a matching address from ${data.provider === 'google' ? 'Google Maps' : 'map'} results.` : 'No matching address found. You can still save your typed address.');
      } catch (error) {
        if (error.name !== 'AbortError') {
          setLocationSuggestions([]);
          setLocationMessage('Map suggestions are not available right now. You can still save manually.');
        }
      } finally {
        setLocationBusy(false);
      }
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [deliveryCityDraft, deliveryLocationDraft, locationOpen]);

  useEffect(() => {
    if (!user?.email) return setOrders([]);
    setOrders(readJson(ordersKey(user.email), []));
  }, [user?.email]);

  useEffect(() => {
    if (user?.email) window.localStorage.setItem(ordersKey(user.email), JSON.stringify(orders));
  }, [orders, user?.email]);

  useEffect(() => {
    if (!token) return;

    let active = true;
    const headers = { Authorization: `Bearer ${token}` };

    fetch(`${API}/api/auth/me`, { headers })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (active && data.user) setUser(data.user);
        return fetch(`${API}/api/orders`, { headers })
          .then((r) => (r.ok ? r.json() : Promise.reject()))
          .then((ordersData) => {
            if (!active) return;
            if (ordersData.user) setUser(ordersData.user);
            if (Array.isArray(ordersData.orders)) setOrders(ordersData.orders);
          })
          .catch(() => { });
      })
      .catch(() => {
        if (!active) return;
        setToken('');
        setUser(null);
        setOrders([]);
      });

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!orders.length) {
      setTrackedOrderId('');
      setTrackingData(null);
      return;
    }

    const hasTrackedOrder = orders.some((order) => order.orderId === trackedOrderId);
    if (!trackedOrderId || !hasTrackedOrder) {
      setTrackedOrderId(orders[0].orderId);
    }
  }, [orders, trackedOrderId]);

  useEffect(() => {
    if (!token || !trackedOrderId) return;

    let active = true;
    const headers = { Authorization: `Bearer ${token}` };
    const syncTracking = () => {
      fetch(`${API}/api/orders/${trackedOrderId}/tracking`, { headers })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data) => {
          if (!active) return;
          setTrackingData(data.tracking ? { ...data.tracking, orderId: data.orderId, shippingAddress: data.shippingAddress } : null);
        })
        .catch(() => {
          if (active) setTrackingData(null);
        });
    };

    syncTracking();
    const interval = window.setInterval(syncTracking, 2500);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [token, trackedOrderId]);

  useEffect(() => () => { if (avatarPhoto.startsWith('blob:')) URL.revokeObjectURL(avatarPhoto); }, [avatarPhoto]);

  useEffect(() => {
    if (!cartOpen && !activeProductId && !locationOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (locationOpen) {
        setLocationOpen(false);
        return;
      }
      if (activeProductId) {
        setActiveProductId('');
        setProductZoom(1);
        return;
      }
      if (window.location.hash === CART_HASH || window.location.hash === ACCOUNT_HASH) {
        window.history.pushState(null, '', `${window.location.pathname}${window.location.search}`);
      }
      setCartOpen(false);
      setAccountOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cartOpen, activeProductId, locationOpen]);

  const currentBanks = store.availableBanks?.length ? store.availableBanks : defaultBanks;
  const categories = ['All', ...new Set(products.map((item) => item.category))];
  const filtered = products.filter((item) => {
    const q = query.trim().toLowerCase();
    const matchesCategory = category === 'All' || item.category === category;
    const matchesQuery = !q || [item.name, item.category, item.description].join(' ').toLowerCase().includes(q);
    return matchesCategory && matchesQuery;
  });
  const findProduct = (productId) => products.find((item) => item._id === productId);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const freeDeliveryThreshold = 599;
  const discountPercent = 10;
  const delivery = cart.length ? (subtotal >= freeDeliveryThreshold ? 0 : 99) : 0;
  const promoDiscount = Math.min(appliedPromo?.discountAmount || 0, subtotal);
  const total = Math.max(0, subtotal - promoDiscount + delivery);
  const freeDeliveryUnlocked = cart.length > 0 && subtotal >= freeDeliveryThreshold;
  const amountForFreeDelivery = Math.max(0, freeDeliveryThreshold - subtotal);
  const preview = products.find((item) => item._id === previewId) || productsFallback[0];
  const activeProduct = activeProductId ? findProduct(activeProductId) : null;
  const activeProductImages = activeProduct ? [activeProduct.image, ...(activeProduct.images || [])].filter(Boolean).filter((value, index, array) => array.indexOf(value) === index) : [];
  const activeProductImageSrc = activeProductImage || activeProductImages[0] || activeProduct?.image || '';
  const activeProductDiscount = activeProduct ? Math.round(activeProduct.price * (discountPercent / 100)) : 0;
  const activeProductOfferPrice = activeProduct ? activeProduct.price - activeProductDiscount : 0;
  const avatarClass = preview.category === 'Bottoms' ? 'look look-bottom' : ['Dresses', 'Occasion'].includes(preview.category) ? 'look look-dress' : 'look look-top';
  const mapLat = Number(deliveryLocationCoords?.lat) || defaultDeliveryCoords.lat;
  const mapLon = Number(deliveryLocationCoords?.lon) || defaultDeliveryCoords.lon;
  const googleStaticMapSrc = `${API}/api/location/static-map?lat=${encodeURIComponent(mapLat)}&lon=${encodeURIComponent(mapLon)}`;
  const osmMapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${mapLon - 0.025}%2C${mapLat - 0.018}%2C${mapLon + 0.025}%2C${mapLat + 0.018}&layer=mapnik&marker=${mapLat}%2C${mapLon}`;
  const fullDeliveryAddress = [deliveryBuilding, deliveryLocation, deliveryCity].filter(Boolean).join(', ');

  useEffect(() => {
    setMapPreviewError(false);
  }, [mapLat, mapLon]);

  const addToCart = (product) => {
    setCart((current) => {
      const existing = current.find((item) => item._id === product._id);
      return existing
        ? current.map((item) => item._id === product._id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current, { ...product, quantity: 1 }];
    });
    setPreviewId(product._id);
    setCheckoutMessage(`${product.name} added to cart.`);
  };

  const changeQty = (id, delta) => setCart((current) => current.map((item) => item._id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item).filter((item) => item.quantity));
  const removeFromCart = (id) => setCart((current) => current.filter((item) => item._id !== id));
  const openProduct = (product) => {
    setActiveProductId(product._id);
    setProductZoom(1);
    setActiveProductImage(product.image || product.images?.[0] || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const closeProduct = () => {
    setActiveProductId('');
    setProductZoom(1);
    setActiveProductImage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const leaveCartPage = () => {
    setCartOpen(false);
    if (window.location.hash === CART_HASH) {
      window.history.pushState(null, '', `${window.location.pathname}${window.location.search}`);
    }
  };

  const openHomePage = (sectionId = 'top') => {
    setLocationOpen(false);
    leaveCartPage();
    setAccountOpen(false);
    if (window.location.hash === ACCOUNT_HASH) {
      window.history.pushState(null, '', `${window.location.pathname}${window.location.search}`);
    }
    setActiveProductId('');
    setProductZoom(1);
    setActiveProductImage('');
    window.setTimeout(() => scrollToSection(sectionId), 0);
  };

  const openCartPage = () => {
    setLocationOpen(false);
    setActiveProductId('');
    setProductZoom(1);
    setActiveProductImage('');
    setAccountOpen(false);
    setCartOpen(true);
    if (window.location.hash !== CART_HASH) {
      window.location.hash = CART_HASH.slice(1);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openAccountPage = (tab = 'profile') => {
    setLocationOpen(false);
    setAccountDropdownOpen(false);
    setActiveProductId('');
    setProductZoom(1);
    setActiveProductImage('');
    setCartOpen(false);
    setAccountOpen(true);
    setAccountTab(tab);
    if (window.location.hash !== ACCOUNT_HASH) {
      window.location.hash = ACCOUNT_HASH.slice(1);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeliveryLocationSubmit = (event) => {
    event.preventDefault();
    const nextBuilding = deliveryBuildingDraft.trim();
    const nextLocation = deliveryLocationDraft.trim();
    const nextCity = deliveryCityDraft.trim() || 'Jaipur';
    if (!nextLocation) {
      setDeliveryBuildingDraft(deliveryBuilding);
      setDeliveryLocationDraft(deliveryLocation);
      setDeliveryCityDraft(deliveryCity);
      setLocationOpen(false);
      return;
    }
    setDeliveryBuilding(nextBuilding);
    setDeliveryCity(nextCity);
    setDeliveryLocation(nextLocation);
    setLocationMessage(`Delivery location saved for ${nextCity}.`);
    setLocationOpen(false);
  };

  const useCurrentStoreLocation = () => {
    const nextLocation = store.storeAddress || defaultStore.storeAddress;
    const nextCity = 'Jaipur';
    setDeliveryBuilding('');
    setDeliveryBuildingDraft('');
    setDeliveryCity(nextCity);
    setDeliveryCityDraft(nextCity);
    setDeliveryLocation(nextLocation);
    setDeliveryLocationDraft(nextLocation);
    setDeliveryLocationCoords(defaultDeliveryCoords);
    setLocationSuggestions([]);
    setLocationOpen(false);
  };

  const selectLocationSuggestion = async (item) => {
    let selectedPlace = item;

    if (item.placeId && (!item.lat || !item.lon)) {
      try {
        setLocationBusy(true);
        setLocationMessage('Loading exact Google Maps pin...');
        const response = await fetch(`${API}/api/location/place/${encodeURIComponent(item.placeId)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Unable to load exact map pin.');
        selectedPlace = data.place || item;
        setLocationProvider(data.provider || 'google');
      } catch (error) {
        setLocationMessage(error.message || 'Could not load exact map pin. You can still save the typed address.');
      } finally {
        setLocationBusy(false);
      }
    }

    const nextLocation = formatMapAddress(selectedPlace);
    const nextCity = resolveAddressCity(selectedPlace) || deliveryCityDraft || deliveryCity || 'Jaipur';
    setDeliveryLocationDraft(nextLocation);
    setDeliveryCityDraft(nextCity);
    if (selectedPlace.lat && selectedPlace.lon) {
      setDeliveryLocationCoords({ lat: Number(selectedPlace.lat), lon: Number(selectedPlace.lon) });
    }
    setLocationMessage('Address selected from map results. Press Save location to use it.');
  };

  const detectCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setLocationMessage('Your browser does not support automatic location detection.');
      return;
    }

    setLocationBusy(true);
    setLocationMessage('Detecting your location...');
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
      });
      const coords = { lat: position.coords.latitude, lon: position.coords.longitude };
      setDeliveryLocationCoords(coords);

      const response = await fetch(`${API}/api/location/reverse?lat=${encodeURIComponent(coords.lat)}&lon=${encodeURIComponent(coords.lon)}`);
      if (!response.ok) throw new Error('Map could not convert your location to an address.');
      const data = await response.json();
      const place = data.place || {};
      const nextLocation = formatMapAddress(place) || `${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}`;
      const nextCity = resolveAddressCity(place) || deliveryCity || 'Jaipur';
      setLocationProvider(data.provider || 'map');
      setDeliveryLocation(nextLocation);
      setDeliveryLocationDraft(nextLocation);
      setDeliveryBuilding('');
      setDeliveryBuildingDraft('');
      setDeliveryCity(nextCity);
      setDeliveryCityDraft(nextCity);
      setLocationSuggestions([]);
      setLocationMessage('Current map location detected and saved.');
    } catch (error) {
      setLocationMessage(error.code === 1 ? 'Location permission was blocked. Add your address manually.' : (error.message || 'Could not detect location. Add your address manually.'));
    } finally {
      setLocationBusy(false);
    }
  };

  const applyPromoCode = async (code = promoInput) => {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      setCheckoutMessage('Enter a promo code first.');
      return;
    }

    if (!subtotal) {
      setCheckoutMessage('Add products before applying a promo code.');
      return;
    }

    setPromoBusy(true);
    setCheckoutMessage('');

    try {
      const response = await fetch(`${API}/api/promocodes/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: normalizedCode, subtotal }),
      });
      const data = await readApiBody(response);
      if (!response.ok) throw new Error(data.message || 'Unable to apply promo code.');

      setAppliedPromo(data);
      setPromoInput(data.code);
      setCheckoutMessage(`${data.code} applied successfully.`);
    } catch (error) {
      setAppliedPromo(null);
      setCheckoutMessage(error.message);
    } finally {
      setPromoBusy(false);
    }
  };

  const removePromoCode = () => {
    setAppliedPromo(null);
    setPromoInput('');
    setCheckoutMessage('Promo code removed.');
  };

  const placeLocalOrder = async (label) => {
    const order = {
      orderId: `FSH-${Date.now()}`,
      items: cart.map(({ _id, name, category, price, quantity, size }) => ({ productId: _id, name, category, price, quantity, size })),
      subtotal,
      discountAmount: promoDiscount,
      deliveryCharge: delivery,
      total,
      promoCode: appliedPromo?.code || '',
      promoDescription: appliedPromo?.description || '',
      paymentMethod: payMethod,
      paymentLabel: label,
      paymentStatus: 'Paid',
      deliveryEta: 'Arriving in 30 mins',
      shippingAddress: fullDeliveryAddress || user?.address || 'Address will be confirmed on call',
      placedAt: new Date().toISOString(),
    };
    try {
      const res = await fetch(`${API}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(order),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to save order.');
      setOrders(Array.isArray(data.orders) ? data.orders : [order]);
      if (data.order?.orderId) {
        setTrackedOrderId(data.order.orderId);
      }
    } catch {
      setOrders((current) => [order, ...current]);
      setTrackedOrderId(order.orderId);
    }
    setCart([]);
    setAppliedPromo(null);
    setPromoInput('');
    setCheckoutMessage(`Order placed successfully with ${label}.`);
  };

  const handleAuth = async (event) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthMessage('');
    try {
      const route = authMode === 'signup' ? 'signup' : 'login';
      const res = await fetch(`${API}/api/auth/${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to authenticate.');
      setToken(data.token);
      setUser(data.user);
      setAuthForm({ name: data.user.name || '', email: data.user.email || '', password: '', phone: data.user.phone || '', address: data.user.address || '' });
      setAuthMessage(authMode === 'signup' ? 'Account created. You can checkout now.' : 'Signed in successfully.');
    } catch (error) {
      setAuthMessage(error.message);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleCheckout = async () => {
    if (!cart.length) return setCheckoutMessage('Your cart is empty.');
    if (!token || !user) {
      setCheckoutMessage('Sign in or create an account before payment.');
      return openAccountPage();
    }
    setPayBusy(true);
    setCheckoutMessage('');
    const label = payMethod === 'UPI' ? `${upiApp} UPI (${store.upiId})` : payMethod === 'Debit Card' || payMethod === 'Credit Card' ? `${bank} ${payMethod}` : 'Razorpay Checkout';
    try {
      const res = await fetch(`${API}/api/payment/razorpay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: total }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Payment could not be started.');
      if (data.mode === 'live' && payMethod === 'Razorpay Checkout') {
        const loaded = await loadRazorpay();
        if (!loaded) throw new Error('Razorpay checkout could not be loaded.');
        const rzp = new window.Razorpay({
          key: data.key,
          amount: data.order.amount,
          currency: data.order.currency,
          name: store.storeName,
          description: store.heroTagline,
          order_id: data.order.id,
          theme: { color: '#111111' },
          method: { upi: true, card: true, netbanking: true, wallet: false, paylater: false, emi: false },
          prefill: { name: user.name, email: user.email, contact: user.phone },
          handler: async () => placeLocalOrder('Razorpay Checkout'),
          modal: { ondismiss: () => setCheckoutMessage('Payment window closed before completion.') },
        });
        rzp.open();
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 700));
        await placeLocalOrder(label);
      }
    } catch (error) {
      setCheckoutMessage(error.message);
    } finally {
      setPayBusy(false);
    }
  };

  const handlePhotoUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    if (!token || !user?.isAdmin) {
      setDashboardMessage('Sign in as an admin before uploading product images.');
      return;
    }

    setProductBusy(true);
    setDashboardMessage('');

    try {
      const uploadedUrls = [];

      for (const file of files) {
        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch(`${API}/api/uploads`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Unable to upload image.');
        uploadedUrls.push(data.url);
      }

      setProductForm((current) => {
        const nextImages = [current.image, ...(current.images || []), ...uploadedUrls]
          .filter(Boolean)
          .filter((value, index, array) => array.indexOf(value) === index);
        return {
          ...current,
          image: current.image || uploadedUrls[0] || '',
          images: nextImages,
        };
      });
      setDashboardMessage(`${uploadedUrls.length} product photo${uploadedUrls.length > 1 ? 's' : ''} uploaded successfully.`);
    } catch (error) {
      setDashboardMessage(error.message);
    } finally {
      setProductBusy(false);
    }
  };

  const handleAddProduct = async (event) => {
    event.preventDefault();
    setProductBusy(true);
    setDashboardMessage('');

    try {
      const response = await fetch(`${API}/api/products${editingProductId ? `/${editingProductId}` : ''}`, {
        method: editingProductId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(productForm),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `Unable to ${editingProductId ? 'update' : 'add'} product.`);

      setProducts((current) => editingProductId ? current.map((item) => item._id === editingProductId ? data : item) : [data, ...current]);
      setProductForm(initialProductForm);
      setEditingProductId('');
      setDashboardMessage(`${data.name} has been ${editingProductId ? 'updated' : 'added'} in the store.`);
    } catch (error) {
      setDashboardMessage(error.message);
    } finally {
      setProductBusy(false);
    }
  };

  const handleSaveStore = async (event) => {
    event.preventDefault();
    setStoreBusy(true);
    setDashboardMessage('');

    const nextBanks = storeForm.availableBanksText
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    const payload = {
      storeName: storeForm.storeName,
      heroTagline: storeForm.heroTagline,
      supportPhone: storeForm.supportPhone,
      supportEmail: storeForm.supportEmail,
      storeAddress: storeForm.storeAddress,
      upiId: storeForm.upiId,
      razorpayKeyId: storeForm.razorpayKeyId,
      upiDiscountText: storeForm.upiDiscountText,
      cardDiscountText: storeForm.cardDiscountText,
      deliveryPromise: storeForm.deliveryPromise,
      deliveryRadius: storeForm.deliveryRadius,
      announcement: storeForm.announcement,
      availableBanks: nextBanks.length ? nextBanks : defaultBanks,
    };

    try {
      const response = await fetch(`${API}/api/store`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to save store settings.');

      const nextStore = {
        ...defaultStore,
        ...data,
        availableBanks: Array.isArray(data.availableBanks) && data.availableBanks.length ? data.availableBanks : defaultBanks,
      };
      setStore(nextStore);
      setStoreForm({ ...nextStore, availableBanksText: nextStore.availableBanks.join(', ') });
      setBank((currentBank) => (nextStore.availableBanks.includes(currentBank) ? currentBank : nextStore.availableBanks[0]));
      setDashboardMessage('Store settings updated successfully.');
    } catch (error) {
      setDashboardMessage(error.message);
    } finally {
      setStoreBusy(false);
    }
  };

  const handleSavePromoCode = async (event) => {
    event.preventDefault();
    setPromoManageBusy(true);
    setDashboardMessage('');

    try {
      const response = await fetch(`${API}/api/promocodes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...promoForm,
          discountValue: Number(promoForm.discountValue),
          minOrderValue: Number(promoForm.minOrderValue),
          maxDiscount: Number(promoForm.maxDiscount),
        }),
      });
      const data = await readApiBody(response);
      if (!response.ok) throw new Error(data.message || 'Unable to save promo code.');

      const savedPromoCode = {
        ...data,
        visibility: data.visibility === 'private' || data.visibility === 'public' ? data.visibility : promoForm.visibility,
      };

      setPromoCodes((current) => {
        const filteredCodes = current.filter((item) => item.code !== savedPromoCode.code);
        return [savedPromoCode, ...filteredCodes];
      });
      setPromoForm(initialPromoForm);
      setDashboardMessage(savedPromoCode.visibility === promoForm.visibility
        ? `${savedPromoCode.code} is ready for checkout.`
        : `Saved ${savedPromoCode.code}, but restart the backend once if the visibility still looks wrong.`);
    } catch (error) {
      setDashboardMessage(error.message);
    } finally {
      setPromoManageBusy(false);
    }
  };

  const handleDeletePromoCode = async (code) => {
    setDashboardMessage('');
    try {
      const response = await fetch(`${API}/api/promocodes/${code}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await readApiBody(response);
      if (!response.ok) throw new Error(data.message || 'Unable to delete promo code.');

      setPromoCodes((current) => current.filter((item) => item.code !== code));
      if (appliedPromo?.code === code) {
        setAppliedPromo(null);
        setPromoInput('');
      }
      setDashboardMessage(`${code} has been removed.`);
    } catch (error) {
      setDashboardMessage(error.message);
    }
  };

  const startEditingProduct = (product) => {
    setEditingProductId(product._id);
    setProductForm({
      name: product.name || '',
      category: product.category || '',
      price: product.price || '',
      description: product.description || '',
      image: product.image || '',
      images: product.images || (product.image ? [product.image] : []),
      fit: product.fit || '',
      size: product.size || '',
      deliveryTime: product.deliveryTime || '30 mins',
      accent: product.accent || 'graphite',
    });
    setDashboardMessage(`Editing ${product.name}.`);
    scrollToSection('store-section');
  };

  const cancelEditingProduct = () => {
    setEditingProductId('');
    setProductForm(initialProductForm);
    setDashboardMessage('Product editor reset.');
  };

  const handleDeleteProduct = async (productId, productName) => {
    setDashboardMessage('');
    try {
      const response = await fetch(`${API}/api/products/${productId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Unable to delete product.');

      setProducts((current) => current.filter((item) => item._id !== productId));
      if (editingProductId === productId) {
        setEditingProductId('');
        setProductForm(initialProductForm);
      }
      setDashboardMessage(`${productName} has been deleted from the store.`);
    } catch (error) {
      setDashboardMessage(error.message);
    }
  };

  return (
    <div className="shell">
      <header className="topbar">
        <button type="button" className="brand brand-image" onClick={() => openHomePage('top')} aria-label={`${store.storeName} home`}>
          <img src={fashinLogo} alt="Fashin" className="brand-logo" />
        </button>
        <button
          type="button"
          className="delivery-location"
          onClick={() => {
            setDeliveryBuildingDraft(deliveryBuilding);
            setDeliveryCityDraft(deliveryCity);
            setDeliveryLocationDraft(deliveryLocation);
            setLocationMessage('');
            setLocationOpen((current) => !current);
          }}
          aria-expanded={locationOpen}
          aria-controls="delivery-location-editor"
          aria-label={`Deliverable location ${fullDeliveryAddress || deliveryLocation}`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
            <path d="M12 21s6-5.1 6-11a6 6 0 0 0-12 0c0 5.9 6 11 6 11Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="10" r="2.2" fill="currentColor" />
          </svg>
          <span>Deliver to</span>
          <strong>{fullDeliveryAddress || 'Mahesh Nagar, Jaipur'}</strong>
        </button>
        {locationOpen ? (
          <form id="delivery-location-editor" className="location-editor" onSubmit={handleDeliveryLocationSubmit}>
            <div className="location-editor-fields">
              <label className="field">
                <span>City</span>
                <input value={deliveryCityDraft} onChange={(event) => setDeliveryCityDraft(event.target.value)} placeholder="Jaipur" />
              </label>
              <label className="field">
                <span>Building / house / flat no.</span>
                <input value={deliveryBuildingDraft} onChange={(event) => setDeliveryBuildingDraft(event.target.value)} placeholder="Flat 204, Tower A, House 17" />
              </label>
              <label className="field">
                <span>Area or full address</span>
                <input value={deliveryLocationDraft} onChange={(event) => setDeliveryLocationDraft(event.target.value)} placeholder="Type area, street, landmark or address" autoFocus />
              </label>
            </div>
            <div className="location-editor-actions">
              <button type="button" className="secondary" onClick={detectCurrentLocation} disabled={locationBusy}>{locationBusy ? 'Detecting...' : 'Detect my location'}</button>
              <button type="submit" className="primary">Save location</button>
              <button type="button" className="secondary" onClick={useCurrentStoreLocation}>Use store area</button>
            </div>
            <div className="location-map-card">
              <iframe
                src={osmMapSrc}
                width="100%"
                height="300"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Delivery location map"
              ></iframe>
              <p>Map preview powered by <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="linkish">OpenStreetMap</a> contributors.</p>
            </div>
            <div className="location-suggestions">
              <div className="location-suggestions-head">
                <strong>Suggested addresses</strong>
                <span>{locationBusy ? 'Searching...' : `${deliveryCityDraft || 'City'} results`}</span>
              </div>
              {locationSuggestions.length ? locationSuggestions.map((item) => (
                <button key={`${item.placeId || item.place_id || item.address}-${item.lat || ''}-${item.lon || ''}`} type="button" className="location-suggestion" onClick={() => selectLocationSuggestion(item)}>
                  <strong>{item.name || item.address?.road || item.address?.suburb || 'Address match'}</strong>
                  <span>{formatMapAddress(item)}</span>
                </button>
              )) : <p className="location-empty">Type at least 3 letters to see familiar addresses in the selected city.</p>}
            </div>
            {locationMessage ? <p className="notice location-notice">{locationMessage}</p> : null}
          </form>
        ) : null}
        <div className="nav-actions">
          <button type="button" className="nav-cart-button" aria-label={`Cart with ${cartCount} items`} onClick={openCartPage}>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon">
              <path d="M3 5h2l2.2 9.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="10" cy="19" r="1.6" fill="currentColor" />
              <circle cx="17" cy="19" r="1.6" fill="currentColor" />
            </svg>
            <span>Cart</span>
            <strong className="nav-cart-count">{cartCount}</strong>
          </button>
          <div className="account-dropdown-wrapper">
            <button type="button" className="nav-account-button" onClick={() => user ? setAccountDropdownOpen(!accountDropdownOpen) : openAccountPage('profile')}>
              {user ? (
                <>
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-icon"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M4 20c0-4 4-7 8-7s8 3 8 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                  <span>{user.name.split(' ')[0]}</span>
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="nav-chevron"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </>
              ) : 'Sign In'}
            </button>
            {accountDropdownOpen && user ? (
              <div className="account-dropdown-menu">
                <div className="dropdown-header">
                  <strong>Your Account</strong>
                </div>
                <button type="button" onClick={() => openAccountPage('profile')}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M4 20c0-4 4-7 8-7s8 3 8 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                  My Profile
                </button>
                <button type="button" onClick={() => openAccountPage('orders')}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 8l-9 5-9-5 9-5 9 5zM21 16l-9 5-9-5M3 12l9 5 9-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Orders
                </button>
                <button type="button" onClick={() => openAccountPage('coupons')}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M3 10c2 0 2 4 0 4M21 10c-2 0-2 4 0 4M9 10l6 4M15 10l-6 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                  Coupons
                </button>
                <button type="button" onClick={() => openAccountPage('wallet')}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M2 10h20M6 15h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                  Saved Cards & Wallet
                </button>
                <button type="button" onClick={() => openAccountPage('addresses')}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 1 1 18 0z" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
                  Saved Addresses
                </button>
                <button type="button" onClick={() => openAccountPage('wishlist')}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1 7.8 7.8 7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Wishlist
                </button>
                {user?.isAdmin ? (
                  <button type="button" onClick={() => openAccountPage('admin')}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h18v18H3z" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M3 9h18M9 21V9" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
                    Store Dashboard
                  </button>
                ) : null}
                <div className="dropdown-divider"></div>
                <button type="button" onClick={() => { setToken(''); setUser(null); setOrders([]); setTrackedOrderId(''); setTrackingData(null); setAppliedPromo(null); setPromoInput(''); setAccountDropdownOpen(false); setCheckoutMessage('You have been signed out.'); setCartOpen(false); setAccountOpen(false); window.location.hash = ''; window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <label className="searchbar"><input value={search} onChange={(e) => startTransition(() => setSearch(e.target.value))} placeholder="Search products" /></label>
      </header>

      <main id="top" className={cartOpen ? 'page cart-page' : accountOpen ? 'page account-page-layout' : activeProduct ? 'page product-page' : 'page'}>
        {cartOpen ? (
          <section className="panel section cart-page-panel" aria-label="Cart checkout">
            <div className="cart-page-head">
              <div>
                <p className="eyebrow">Cart</p>
                <h2>Your bag</h2>
              </div>
              <button type="button" className="secondary cart-close" onClick={() => openHomePage('products-section')}>Continue shopping</button>
            </div>
            <div className="cart-page-grid">
              <div className="cart-block cart-sheet">
                <p className="eyebrow">Products</p>
                <div className="cart-list">
                  {cart.length ? cart.map((item) => (
                    <div key={item._id} className="cart-card">
                      <div className="cart-card-copy"><strong>{item.name}</strong><p>{item.category}</p></div>
                      <div className="cart-card-actions">
                        <div className="cart-qty">
                          <button type="button" className="cart-qty-button" onClick={() => changeQty(item._id, -1)}>-</button>
                          <span>{item.quantity}</span>
                          <button type="button" className="cart-qty-button" onClick={() => changeQty(item._id, 1)}>+</button>
                        </div>
                        <strong className="cart-card-price">{money(item.price * item.quantity)}</strong>
                        <button type="button" className="cart-remove-button" onClick={() => removeFromCart(item._id)}>Remove</button>
                      </div>
                    </div>
                  )) : <div className="cart-empty"><strong>Your cart is empty.</strong><p>Add products to see them here.</p></div>}
                </div>
              </div>
              <div className="cart-block cart-checkout-panel">
                <p className="eyebrow">Checkout</p>
                <div className="cart-payment-grid">{paymentOptions.map((item) => <button key={item} type="button" className={payMethod === item ? 'cart-method cart-method-active' : 'cart-method'} onClick={() => setPayMethod(item)}>{item}</button>)}</div>
                {payMethod === 'UPI' ? <label className="cart-select-field"><span>Preferred UPI app</span><select value={upiApp} onChange={(e) => setUpiApp(e.target.value)}>{upiApps.map((item) => <option key={item}>{item}</option>)}</select></label> : null}
                {payMethod === 'Debit Card' || payMethod === 'Credit Card' ? <label className="cart-select-field"><span>Card issuing bank</span><select value={bank} onChange={(e) => setBank(e.target.value)}>{currentBanks.map((item) => <option key={item}>{item}</option>)}</select></label> : null}
                <div className="cart-promo-box">
                  <div className="cart-promo-head">
                    <strong>Promo code</strong>
                    {appliedPromo ? <button type="button" className="linkish" onClick={removePromoCode}>Remove</button> : null}
                  </div>
                  <div className="cart-promo-row">
                    <input value={promoInput} onChange={(event) => setPromoInput(event.target.value.toUpperCase())} placeholder="Enter promo code" />
                    <button type="button" className="secondary" onClick={() => applyPromoCode()} disabled={promoBusy}>{promoBusy ? 'Applying...' : 'Apply'}</button>
                  </div>
                  <div className="cart-promo-chips">
                    {promoCodes.filter((item) => item.active !== false && (item.visibility || 'public') !== 'private').slice(0, 4).map((item) => <button key={item.code} type="button" className="chip" onClick={() => applyPromoCode(item.code)}>{item.code}</button>)}
                  </div>
                  {appliedPromo ? <p className="cart-promo-status">{appliedPromo.code} saves {money(promoDiscount)} on this order.</p> : null}
                </div>
                {cart.length ? <div className="cart-delivery-note"><strong>{freeDeliveryUnlocked ? 'Free delivery unlocked' : 'Free delivery above Rs 599'}</strong><span>{freeDeliveryUnlocked ? 'This order qualifies for free delivery.' : `Add ${money(amountForFreeDelivery)} more to remove the delivery fee.`}</span></div> : null}
                <div className="cart-total-row"><span>Items</span><strong>{cartCount}</strong></div>
                <div className="cart-total-row"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
                <div className="cart-total-row"><span>Promo discount</span><strong>{promoDiscount ? `- ${money(promoDiscount)}` : money(0)}</strong></div>
                <div className="cart-total-row"><span>Delivery</span><strong>{freeDeliveryUnlocked ? 'Free' : money(delivery)}</strong></div>
                <div className="cart-total-row cart-total-row-strong"><span>Total</span><strong>{money(total)}</strong></div>
                <button type="button" className="primary full cart-checkout-button" onClick={handleCheckout} disabled={payBusy}>{payBusy ? 'Processing...' : 'Pay and place order'}</button>
                {checkoutMessage ? <p className="notice">{checkoutMessage}</p> : null}
              </div>
            </div>
          </section>
        ) : activeProduct ? (
          <section className="panel section product-detail-page" aria-label={`${activeProduct.name} details`}>
            <div className="product-detail-head">
              <div>
                <p className="eyebrow">{activeProduct.category}</p>
                <h2>{activeProduct.name}</h2>
              </div>
              <button type="button" className="secondary" onClick={closeProduct}>Back to shop</button>
            </div>
            <div className="product-detail-body">
              <div className="product-detail-media-panel">
                <div className="product-detail-media">
                  <span className="product-discount-badge product-discount-badge-modal">Extra {discountPercent}% off</span>
                  {activeProductImageSrc ? (
                    <img
                      src={resolveImageSrc(activeProductImageSrc)}
                      alt={activeProduct.name}
                      className="product-detail-image"
                      style={{ transform: `scale(${productZoom})` }}
                    />
                  ) : (
                    <div className={`visual ${activeProduct.accent} product-detail-visual`} style={{ transform: `scale(${productZoom})` }}>
                      {activeProduct.category}
                    </div>
                  )}
                </div>
                {activeProductImages.length > 1 ? <div className="product-gallery-strip">{activeProductImages.map((image) => <button key={image} type="button" className={activeProductImageSrc === image ? 'product-gallery-thumb product-gallery-thumb-active' : 'product-gallery-thumb'} onClick={() => setActiveProductImage(image)}><img src={resolveImageSrc(image)} alt={`${activeProduct.name} preview`} className="product-gallery-thumb-image" /></button>)}</div> : null}
                <div className="product-zoom-controls">
                  <button type="button" className="secondary" onClick={() => setProductZoom((current) => Math.max(1, Number((current - 0.15).toFixed(2))))}>Zoom out</button>
                  <span>{Math.round(productZoom * 100)}%</span>
                  <button type="button" className="secondary" onClick={() => setProductZoom((current) => Math.min(1.9, Number((current + 0.15).toFixed(2))))}>Zoom in</button>
                </div>
              </div>
              <div className="product-detail-copy">
                <div className="product-detail-pricing">
                  <strong>{money(activeProductOfferPrice)}</strong>
                  <span>{money(activeProduct.price)}</span>
                </div>
                <p>{activeProduct.description}</p>
                <div className="product-detail-stack">
                  <div className="product-detail-card">
                    <span>Fit</span>
                    <strong>{activeProduct.fit}</strong>
                  </div>
                  <div className="product-detail-card">
                    <span>Size</span>
                    <strong>{activeProduct.size}</strong>
                  </div>
                  <div className="product-detail-card">
                    <span>Delivery</span>
                    <strong>{activeProduct.deliveryTime}</strong>
                  </div>
                </div>
                <div className="product-detail-side-note">
                  <strong>Extra discount and delivery</strong>
                  <p>Extra {discountPercent}% off on this pick and free delivery above Rs 599.</p>
                </div>
                <div className="product-detail-stack">
                  <div className="product-detail-card">
                    <span>UPI offer</span>
                    <strong>{store.upiDiscountText}</strong>
                  </div>
                  <div className="product-detail-card">
                    <span>Card offer</span>
                    <strong>{store.cardDiscountText}</strong>
                  </div>
                </div>
                <div className="row">
                  <button type="button" className="primary" onClick={() => addToCart(activeProduct)}>Add to cart</button>
                  <button type="button" className="secondary" onClick={() => { closeProduct(); setPreviewId(activeProduct._id); setPreviewMessage(`Previewing ${activeProduct.name} on your AI board.`); scrollToSection('avatar-section'); }}>Try on</button>
                </div>
              </div>
            </div>
          </section>
        ) : accountOpen ? (
          <div className="account-dashboard-wrapper">
            {!user ? (
              <div className="account-login-container panel section">
                <div className="section-head"><div><p className="eyebrow">Account</p><h2>Sign in or sign up</h2></div><span>Guest</span></div>
                <form className="auth" onSubmit={handleAuth}><div className="toggle"><button type="button" className={authMode === 'signup' ? 'chip chip-active' : 'chip'} onClick={() => setAuthMode('signup')}>Sign up</button><button type="button" className={authMode === 'login' ? 'chip chip-active' : 'chip'} onClick={() => setAuthMode('login')}>Sign in</button></div>{authMode === 'signup' ? <label className="field"><span>Full name</span><input value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} required /></label> : null}<label className="field"><span>Email</span><input type="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} required /></label><label className="field"><span>Password</span><input type="password" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} required /></label>{authMode === 'signup' ? <><label className="field"><span>Phone</span><input value={authForm.phone} onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })} /></label><label className="field"><span>Delivery address</span><textarea rows="3" value={authForm.address} onChange={(e) => setAuthForm({ ...authForm, address: e.target.value })} /></label></> : null}<button type="submit" className="primary full" disabled={authBusy}>{authBusy ? 'Please wait...' : authMode === 'signup' ? 'Create account' : 'Sign in'}</button></form>
                {authMessage ? <p className="notice">{authMessage}</p> : null}
              </div>
            ) : (
              <div className="account-dashboard-layout">
                <aside className="fashin-sidebar">
                  <div className="sidebar-profile-box">
                    <div className="avatar-placeholder">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    <div className="sidebar-profile-text">
                      <p>Hello,</p>
                      <strong>{user.name}</strong>
                    </div>
                  </div>
                  
                  <div className="sidebar-nav-group">
                    <button type="button" className={`sidebar-nav-item ${accountTab === 'orders' ? 'active' : ''}`} onClick={() => setAccountTab('orders')}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8l-9 5-9-5 9-5 9 5zM21 16l-9 5-9-5M3 12l9 5 9-5"/></svg>
                      MY ORDERS
                      <svg viewBox="0 0 24 24" className="arrow" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                  </div>

                  <div className="sidebar-nav-group">
                    <div className="sidebar-nav-header">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      ACCOUNT SETTINGS
                    </div>
                    <button type="button" className={`sidebar-sub-item ${accountTab === 'profile' ? 'active' : ''}`} onClick={() => setAccountTab('profile')}>Profile Information</button>
                    <button type="button" className={`sidebar-sub-item ${accountTab === 'addresses' ? 'active' : ''}`} onClick={() => setAccountTab('addresses')}>Manage Addresses</button>
                    <button type="button" className="sidebar-sub-item" onClick={() => setAccountTab('pan')}>Aadhar Card Information</button>
                  </div>

                  <div className="sidebar-nav-group">
                    <div className="sidebar-nav-header">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg>
                      PAYMENTS
                    </div>
                    <button type="button" className="sidebar-sub-item" onClick={() => setAccountTab('giftcards')}>
                      Gift Cards <span className="gift-balance">₹0</span>
                    </button>
                    <button type="button" className="sidebar-sub-item" onClick={() => setAccountTab('upi')}>Saved UPI</button>
                    <button type="button" className={`sidebar-sub-item ${accountTab === 'wallet' ? 'active' : ''}`} onClick={() => setAccountTab('wallet')}>Saved Cards</button>
                  </div>
                  
                  <div className="sidebar-nav-group">
                    <div className="sidebar-nav-header">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      MY STUFF
                    </div>
                    <button type="button" className={`sidebar-sub-item ${accountTab === 'coupons' ? 'active' : ''}`} onClick={() => setAccountTab('coupons')}>My Coupons</button>
                    <button type="button" className="sidebar-sub-item" onClick={() => setAccountTab('reviews')}>My Reviews & Ratings</button>
                    <button type="button" className="sidebar-sub-item" onClick={() => setAccountTab('notifications')}>All Notifications</button>
                    <button type="button" className={`sidebar-sub-item ${accountTab === 'wishlist' ? 'active' : ''}`} onClick={() => setAccountTab('wishlist')}>My Wishlist</button>
                  </div>

                  {user?.isAdmin && (
                    <div className="sidebar-nav-group">
                       <button type="button" className={`sidebar-nav-item ${accountTab === 'admin' ? 'active' : ''}`} onClick={() => setAccountTab('admin')}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3h18v18H3z"/><path d="M3 9h18M9 21V9"/></svg>
                        STORE DASHBOARD
                        <svg viewBox="0 0 24 24" className="arrow" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                      </button>
                    </div>
                  )}

                  <div className="sidebar-nav-group" style={{borderBottom: 'none'}}>
                    <button type="button" className="sidebar-nav-item" onClick={() => { setToken(''); setUser(null); setAccountOpen(false); window.location.hash = ''; }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                      Logout
                    </button>
                  </div>
                </aside>
                
                <div className="fashin-content">
                  {accountTab === 'profile' && (
                    <div className="fashin-profile-card">
                      
                      <div className="profile-section">
                        <div className="profile-section-header">
                          <h3>Personal Information</h3>
                          {!editingPersonalInfo ? 
                            <button type="button" className="edit-btn" onClick={() => setEditingPersonalInfo(true)}>Edit</button> : 
                            <button type="button" className="edit-btn save-btn" onClick={() => handleSaveProfile('personal')}>Save</button>
                          }
                        </div>
                        <div className="profile-form-row">
                          <input type="text" value={profileForm.firstName} onChange={(e) => setProfileForm({...profileForm, firstName: e.target.value})} disabled={!editingPersonalInfo} placeholder="First Name" />
                          <input type="text" value={profileForm.lastName} onChange={(e) => setProfileForm({...profileForm, lastName: e.target.value})} disabled={!editingPersonalInfo} placeholder="Last Name" />
                        </div>
                        <div className="profile-gender-row">
                          <span>Your Gender</span>
                          <label className={`gender-radio ${profileForm.gender === 'Male' ? 'selected' : ''}`}>
                            <input type="radio" name="gender" value="Male" checked={profileForm.gender === 'Male'} onChange={(e) => setProfileForm({...profileForm, gender: e.target.value})} disabled={!editingPersonalInfo} />
                            Male
                          </label>
                          <label className={`gender-radio ${profileForm.gender === 'Female' ? 'selected' : ''}`}>
                            <input type="radio" name="gender" value="Female" checked={profileForm.gender === 'Female'} onChange={(e) => setProfileForm({...profileForm, gender: e.target.value})} disabled={!editingPersonalInfo} />
                            Female
                          </label>
                        </div>
                      </div>

                      <div className="profile-section">
                        <div className="profile-section-header">
                          <h3>Email Address</h3>
                          {!editingEmail ? 
                            <button type="button" className="edit-btn" onClick={() => setEditingEmail(true)}>Edit</button> : 
                            <button type="button" className="edit-btn save-btn" onClick={() => handleSaveProfile('email')}>Save</button>
                          }
                        </div>
                        <div className="profile-form-row single">
                          <input type="email" value={profileForm.email} onChange={(e) => setProfileForm({...profileForm, email: e.target.value})} disabled={!editingEmail} placeholder="Email Address" />
                        </div>
                      </div>

                      <div className="profile-section">
                        <div className="profile-section-header">
                          <h3>Mobile Number</h3>
                          {!editingPhone ? 
                            <button type="button" className="edit-btn" onClick={() => setEditingPhone(true)}>Edit</button> : 
                            <button type="button" className="edit-btn save-btn" onClick={() => handleSaveProfile('phone')}>Save</button>
                          }
                        </div>
                        <div className="profile-form-row single">
                          <input type="tel" value={profileForm.phone} onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})} disabled={!editingPhone} placeholder="Mobile Number" />
                        </div>
                      </div>

                      <div className="profile-section faq-section">
                        <h3>FAQs</h3>
                        <div className="faq-item">
                          <strong>What happens when I update my email address (or mobile number)?</strong>
                          <p>Your login email id (or mobile number) changes, likewise. You'll receive all your account related communication on your updated email address (or mobile number).</p>
                        </div>
                        <div className="faq-item">
                          <strong>When will my Fashin account be updated with the new email address (or mobile number)?</strong>
                          <p>It happens as soon as you confirm the verification code sent to your email (or mobile) and save the changes.</p>
                        </div>
                        <div className="faq-item">
                          <strong>What happens to my existing Fashin account when I update my email address (or mobile number)?</strong>
                          <p>Updating your email address (or mobile number) doesn't invalidate your account. Your account remains fully functional. You'll continue seeing your Order history, saved information and personal details.</p>
                        </div>
                      </div>

                    </div>
                  )}

                  {accountTab === 'orders' && (
                    <div className="fashin-generic-card">
                      <section id="orders-section" className="panel section orders-page">
                  <div className="section-head"><div><p className="eyebrow">Order history</p><h2>Your recent orders</h2></div><span>{orders.length} orders</span></div>
                  <div className="order-history-list">
                    {orders.length ? orders.map((order) => {
                      const firstItem = order.items?.[0];
                      const previewProduct = firstItem ? findProduct(firstItem.productId) : null;
                      const previewImage = previewProduct?.image ? resolveImageSrc(previewProduct.image) : '';
                      return (
                        <article key={order.orderId} className="fashin-order-card">
                          <div className="fashin-order-visual">
                            {previewImage ? <img src={previewImage} alt={firstItem?.name || 'Ordered product'} className="fashin-order-image" /> : <div className={`fashin-order-image visual ${(previewProduct?.accent) || 'graphite'}`}>{firstItem?.category || 'Order'}</div>}
                          </div>
                          <div className="fashin-order-copy">
                            <strong>{firstItem?.name || order.orderId}</strong>
                            <p>{(firstItem?.quantity || 0) > 1 ? `${firstItem.quantity} units ordered` : 'Single item order'}{order.items?.length > 1 ? ` • +${order.items.length - 1} more items` : ''}</p>
                            <p>{order.paymentLabel || order.paymentMethod}</p>
                            {order.promoCode ? <p>Promo: {order.promoCode}</p> : null}
                            <span>{new Date(order.placedAt).toLocaleString('en-IN')}</span>
                          </div>
                          <div className="fashin-order-status">
                            <strong>{money(order.total)}</strong>
                            <p>{order.deliveryEta}</p>
                            <button type="button" className="secondary" onClick={() => { setTrackedOrderId(order.orderId); scrollToSection('tracking-section'); }}>Track rider</button>
                          </div>
                        </article>
                      );
                    }) : <div className="card"><strong>No orders yet.</strong><p>Your completed purchases will appear here.</p></div>}
                  </div>
                </section>
                    </div>
                  )}

                  {accountTab === 'tracking' && (
                    <div className="fashin-generic-card">
                      <section id="tracking-section" className="panel section tracking-section">
                  <div className="section-head"><div><p className="eyebrow">India delivery map</p><h2>See where your rider is right now</h2></div><span>{trackingData?.status || 'Live tracking'}</span></div>
                  {orders.length ? <>
                    <div className="tracking-order-strip">
                      {orders.map((order) => <button key={order.orderId} type="button" className={trackedOrderId === order.orderId ? 'chip chip-active' : 'chip'} onClick={() => setTrackedOrderId(order.orderId)}>{order.orderId}</button>)}
                    </div>
                    <div className="tracking-grid">
                      <div className="tracking-map-card">
                        <div className="tracking-map-shell">
                          <svg viewBox="0 0 100 100" className="india-map" aria-hidden="true">
                            <path d={indiaMapPath} />
                          </svg>
                          <svg viewBox="0 0 100 100" className="tracking-route" aria-hidden="true">
                            <line x1={trackingData?.routeStart?.x || 39} y1={trackingData?.routeStart?.y || 42} x2={trackingData?.routeEnd?.x || 42} y2={trackingData?.routeEnd?.y || 50} />
                          </svg>
                          <div className="map-pin map-pin-origin" style={{ left: `${trackingData?.routeStart?.x || 39}%`, top: `${trackingData?.routeStart?.y || 42}%` }}><span>Hub</span></div>
                          <div className="map-pin map-pin-destination" style={{ left: `${trackingData?.routeEnd?.x || 42}%`, top: `${trackingData?.routeEnd?.y || 50}%` }}><span>You</span></div>
                          <div className="map-pin map-pin-rider" style={{ left: `${trackingData?.currentLocation?.x || trackingData?.routeStart?.x || 39}%`, top: `${trackingData?.currentLocation?.y || trackingData?.routeStart?.y || 42}%` }}><span>Rider</span></div>
                        </div>
                      </div>
                      <div className="tracking-info-card">
                        <div className="tracking-stat-grid">
                          <div className="tracking-stat"><span>Status</span><strong>{trackingData?.status || 'Waiting for tracking'}</strong></div>
                          <div className="tracking-stat"><span>ETA</span><strong>{trackingData ? `${trackingData.etaMinutes} min` : '--'}</strong></div>
                          <div className="tracking-stat"><span>City</span><strong>{trackingData?.city || 'Jaipur'}</strong></div>
                          <div className="tracking-stat"><span>Progress</span><strong>{trackingData ? `${trackingData.progress}%` : '0%'}</strong></div>
                        </div>
                        <div className="tracking-rider-card">
                          <strong>{trackingData?.riderName || 'Rider will be assigned soon'}</strong>
                          <p>Rider ID: {trackingData?.riderId || '--'}</p>
                          <p>Phone: {trackingData?.riderPhone || '--'}</p>
                          <p>From: {trackingData?.originLabel || 'Fashin hub'}</p>
                          <p>To: {trackingData?.destinationLabel || 'Your delivery location'}</p>
                        </div>
                        <div className="tracking-note">
                          <strong>Live movement</strong>
                          <p>The rider marker updates automatically while the order is moving toward your address.</p>
                        </div>
                      </div>
                    </div>
                  </> : <div className="card"><strong>No live deliveries yet.</strong><p>Place an order to see the rider route on the India map.</p></div>}
                </section>
                    </div>
                  )}

                  {accountTab === 'admin' && (
                    <div className="fashin-generic-card">
                      <section id="store-section" className="panel section">
                  <div className="section-head"><div><p className="eyebrow">Store dashboard</p><h2>Add products with photos and manage payments</h2></div><span>Admin tools</span></div>
                  {user?.isAdmin ? <div className="dashboard-grid">
                    <form className="panel inset dashboard-form" onSubmit={handleAddProduct}>
                      <div className="form-header"><strong>Add a product</strong><span>Upload a photo or paste an image URL</span></div>
                      <label className="field"><span>Product name</span><input value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} required /></label>
                      <label className="field"><span>Category</span><input value={productForm.category} onChange={(event) => setProductForm({ ...productForm, category: event.target.value })} required /></label>
                      <label className="field"><span>Price (INR)</span><input type="number" min="1" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} required /></label>
                      <label className="field"><span>Description</span><textarea rows="3" value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} required /></label>
                      <label className="field"><span>Primary image URL</span><input value={productForm.image} onChange={(event) => setProductForm({ ...productForm, image: event.target.value })} placeholder="https://..." /></label>
                      <label className="field"><span>More image URLs</span><textarea rows="3" value={(productForm.images || []).filter((image) => image !== productForm.image).join(', ')} onChange={(event) => setProductForm({ ...productForm, images: [productForm.image, ...event.target.value.split(',').map((item) => item.trim()).filter(Boolean)].filter(Boolean).filter((value, index, array) => array.indexOf(value) === index) })} placeholder="https://image1..., https://image2..." /></label>
                      <label className="field"><span>Or upload product photos</span><input type="file" accept="image/*" multiple onChange={handlePhotoUpload} /></label>
                      <div className="dashboard-mini-grid">
                        <label className="field"><span>Fit</span><input value={productForm.fit} onChange={(event) => setProductForm({ ...productForm, fit: event.target.value })} /></label>
                        <label className="field"><span>Size</span><input value={productForm.size} onChange={(event) => setProductForm({ ...productForm, size: event.target.value })} /></label>
                        <label className="field"><span>Delivery time</span><input value={productForm.deliveryTime} onChange={(event) => setProductForm({ ...productForm, deliveryTime: event.target.value })} /></label>
                        <label className="field"><span>Accent</span><select value={productForm.accent} onChange={(event) => setProductForm({ ...productForm, accent: event.target.value })}>{['graphite', 'silver', 'pearl', 'charcoal', 'slate', 'obsidian', 'smoke', 'ash'].map((item) => <option key={item}>{item}</option>)}</select></label>
                      </div>
                      {(productForm.images || productForm.image ? [productForm.image, ...(productForm.images || [])].filter(Boolean).filter((value, index, array) => array.indexOf(value) === index) : []).length ? <div className="dashboard-gallery-preview">{[productForm.image, ...(productForm.images || [])].filter(Boolean).filter((value, index, array) => array.indexOf(value) === index).map((image) => <img key={image} src={resolveImageSrc(image)} alt="Product preview" className="dashboard-image-preview" />)}</div> : null}
                      <div className="row">
                        <button type="submit" className="primary full" disabled={productBusy}>{productBusy ? (editingProductId ? 'Updating product...' : 'Adding product...') : (editingProductId ? 'Update product' : 'Add product to store')}</button>
                        {editingProductId ? <button type="button" className="secondary full" onClick={cancelEditingProduct}>Cancel edit</button> : null}
                      </div>
                    </form>

                    <form className="panel inset dashboard-form" onSubmit={handleSaveStore}>
                      <div className="form-header"><strong>Store settings</strong><span>Razorpay public key, UPI ID, support details, banks and delivery details</span></div>
                      <label className="field"><span>Store name</span><input value={storeForm.storeName} onChange={(event) => setStoreForm({ ...storeForm, storeName: event.target.value })} required /></label>
                      <label className="field"><span>Hero tagline</span><input value={storeForm.heroTagline} onChange={(event) => setStoreForm({ ...storeForm, heroTagline: event.target.value })} required /></label>
                      <label className="field"><span>Announcement</span><textarea rows="3" value={storeForm.announcement} onChange={(event) => setStoreForm({ ...storeForm, announcement: event.target.value })} /></label>
                      <div className="dashboard-mini-grid">
                        <label className="field"><span>Support phone</span><input value={storeForm.supportPhone} onChange={(event) => setStoreForm({ ...storeForm, supportPhone: event.target.value })} /></label>
                        <label className="field"><span>Support email</span><input value={storeForm.supportEmail} onChange={(event) => setStoreForm({ ...storeForm, supportEmail: event.target.value })} /></label>
                        <label className="field"><span>UPI ID</span><input value={storeForm.upiId} onChange={(event) => setStoreForm({ ...storeForm, upiId: event.target.value })} /></label>
                        <label className="field"><span>Razorpay Key ID</span><input value={storeForm.razorpayKeyId} onChange={(event) => setStoreForm({ ...storeForm, razorpayKeyId: event.target.value })} placeholder="rzp_test_..." /></label>
                      </div>
                      <div className="dashboard-mini-grid">
                        <label className="field"><span>UPI discount offer</span><input value={storeForm.upiDiscountText} onChange={(event) => setStoreForm({ ...storeForm, upiDiscountText: event.target.value })} placeholder="Extra 10% off on UPI payments" /></label>
                        <label className="field"><span>Card discount offer</span><input value={storeForm.cardDiscountText} onChange={(event) => setStoreForm({ ...storeForm, cardDiscountText: event.target.value })} placeholder="Save 5% with debit or credit cards" /></label>
                      </div>
                      <label className="field"><span>Store address</span><input value={storeForm.storeAddress} onChange={(event) => setStoreForm({ ...storeForm, storeAddress: event.target.value })} /></label>
                      <div className="dashboard-mini-grid">
                        <label className="field"><span>Delivery promise</span><input value={storeForm.deliveryPromise} onChange={(event) => setStoreForm({ ...storeForm, deliveryPromise: event.target.value })} /></label>
                        <label className="field"><span>Delivery radius</span><input value={storeForm.deliveryRadius} onChange={(event) => setStoreForm({ ...storeForm, deliveryRadius: event.target.value })} /></label>
                      </div>
                      <label className="field"><span>Available banks</span><textarea rows="3" value={storeForm.availableBanksText} onChange={(event) => setStoreForm({ ...storeForm, availableBanksText: event.target.value })} placeholder="HDFC Bank, ICICI Bank, State Bank of India" /></label>
                      <div className="dashboard-tip"><strong>Secret key note</strong><p>Use this dashboard for the Razorpay Key ID only. Keep the Razorpay Secret in the backend `.env` file for security.</p></div>
                      <button type="submit" className="primary full" disabled={storeBusy}>{storeBusy ? 'Saving settings...' : 'Save store settings'}</button>
                    </form>
                    <div className="panel inset dashboard-form dashboard-catalog">
                      <div className="form-header"><strong>Manage products</strong><span>Edit or delete existing catalog items</span></div>
                      <div className="stack">
                        {products.map((item) => <div key={item._id} className="card card-product-admin">{item.image ? <img src={resolveImageSrc(item.image)} alt={item.name} className="admin-thumb" /> : <div className={`admin-thumb visual ${item.accent}`}>{item.category}</div>}<div><strong>{item.name}</strong><p>{item.category} | {money(item.price)}</p><p>{((item.images || []).length || (item.image ? 1 : 0))} photos</p></div><div className="row"><button type="button" className="secondary" onClick={() => startEditingProduct(item)}>Edit</button><button type="button" className="secondary danger" onClick={() => handleDeleteProduct(item._id, item.name)}>Delete</button></div></div>)}
                      </div>
                    </div>
                    <form className="panel inset dashboard-form" onSubmit={handleSavePromoCode}>
                      <div className="form-header"><strong>Promo code manager</strong><span>Add promo codes customers can use at checkout</span></div>
                      <label className="field"><span>Promo code</span><input value={promoForm.code} onChange={(event) => setPromoForm({ ...promoForm, code: event.target.value.toUpperCase() })} placeholder="FASHIN10" required /></label>
                      <label className="field"><span>Description</span><input value={promoForm.description} onChange={(event) => setPromoForm({ ...promoForm, description: event.target.value })} placeholder="10% off on your first order" required /></label>
                      <div className="dashboard-mini-grid">
                        <label className="field"><span>Visibility</span><select value={promoForm.visibility} onChange={(event) => setPromoForm({ ...promoForm, visibility: event.target.value })}><option value="public">Public</option><option value="private">Private</option></select></label>
                        <label className="field"><span>Discount type</span><select value={promoForm.discountType} onChange={(event) => setPromoForm({ ...promoForm, discountType: event.target.value })}><option value="percent">Percent</option><option value="flat">Flat</option></select></label>
                        <label className="field"><span>Discount value</span><input type="number" min="1" value={promoForm.discountValue} onChange={(event) => setPromoForm({ ...promoForm, discountValue: event.target.value })} required /></label>
                        <label className="field"><span>Minimum order value</span><input type="number" min="0" value={promoForm.minOrderValue} onChange={(event) => setPromoForm({ ...promoForm, minOrderValue: event.target.value })} /></label>
                        <label className="field"><span>Maximum discount</span><input type="number" min="0" value={promoForm.maxDiscount} onChange={(event) => setPromoForm({ ...promoForm, maxDiscount: event.target.value })} /></label>
                      </div>
                      <label className="field checkbox-field"><span>Active for customers</span><input type="checkbox" checked={promoForm.active} onChange={(event) => setPromoForm({ ...promoForm, active: event.target.checked })} /></label>
                      <button type="submit" className="primary full" disabled={promoManageBusy}>{promoManageBusy ? 'Saving promo code...' : 'Save promo code'}</button>
                      <div className="stack promo-admin-list">
                        {promoCodes.map((item) => <div key={item.code} className="card promo-admin-card"><div><strong>{item.code}</strong><p>{item.description}</p><p>{(item.visibility || 'public') === 'private' ? 'Private promo code' : 'Public promo code'}</p></div><div><p>{item.discountType === 'flat' ? `${money(item.discountValue)} off` : `${item.discountValue}% off`}</p><p>Min order {money(item.minOrderValue || 0)}</p></div><button type="button" className="secondary danger" onClick={() => handleDeletePromoCode(item.code)}>Delete</button></div>)}
                      </div>
                    </form>
                  </div> : <div className="panel inset admin-locked"><strong>Admin access only</strong><p>Sign in with an admin account to add, edit, delete products, upload product images, and manage Razorpay and store settings.</p></div>}
                  {dashboardMessage ? <p className="notice">{dashboardMessage}</p> : null}
                </section>
                    </div>
                  )}                  {['addresses', 'pan', 'giftcards', 'upi', 'wallet', 'coupons', 'reviews', 'notifications', 'wishlist'].includes(accountTab) && (
                    <div className="fashin-generic-card placeholder-card">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><circle cx="12" cy="12" r="6"/><path d="M12 8v4l3 3"/></svg>
                      <h3>Coming Soon</h3>
                      <p>This section is currently under development.</p>
                    </div>
                  )}

                </div>
              </div>
            )}
          </div>
            
) : <>
              <section className="ribbon-section" aria-label="Ribbon announcement">
                <div className="ribbon-track">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <span key={index}>WEAR IT NOW NOT TOMMOROW</span>
                  ))}
                </div>
              </section>

              <section className="grid">
                <section id="products-section" className="panel section full-span">
                  <div className="section-head"><div><p className="eyebrow">Storefront</p><h2>Search and shop</h2></div><span>{filtered.length} products</span></div>
                  <div className="filter-bar">
                    <label className="field filter-field">
                      <span>Product category filter</span>
                      <select value={category} onChange={(event) => setCategory(event.target.value)}>
                        {categories.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </label>
                    <button type="button" className="secondary filter-reset" onClick={() => setCategory('All')}>Show all</button>
                  </div>
                  <div className="chips">{categories.map((item) => <button key={item} type="button" className={category === item ? 'chip chip-active' : 'chip'} onClick={() => setCategory(item)}>{item}</button>)}</div>
                  <div className="products">{filtered.map((item) => (
                    <article key={item._id} className="product">
                      <div className="product-media-shell">
                        <button type="button" className="product-media-button" onClick={() => openProduct(item)} aria-label={`Open ${item.name}`}>
                          {item.image ? <img src={resolveImageSrc(item.image)} alt={item.name} className="product-image" /> : <div className={`visual ${item.accent}`}>{item.category}</div>}
                        </button>
                        <span className="product-discount-badge">Extra {discountPercent}% off</span>
                      </div>
                      <div className="product-body">
                        <div className="product-top">
                          <div>
                            <button type="button" className="product-title-button" onClick={() => openProduct(item)}>
                              <h3>{item.name}</h3>
                            </button>
                            <p>{item.description}</p>
                          </div>
                          <strong>{money(item.price)}</strong>
                        </div>
                        <div className="chips small"><span>{item.fit}</span><span>{item.size}</span><span>{item.deliveryTime}</span></div>
                        <div className="product-shipping-note">Free delivery above Rs 599</div>
                        <div className="row">
                          <button type="button" className="primary" onClick={() => addToCart(item)}>Add to cart</button>
                          <button type="button" className="secondary" onClick={() => { setPreviewId(item._id); setPreviewMessage(`Previewing ${item.name} on your AI board.`); scrollToSection('avatar-section'); }}>Try on</button>
                        </div>
                      </div>
                    </article>
                  ))}</div>
                </section>
              </section>

              <section className="grid lower">
                <section id="avatar-section" className="panel section">
                  <div className="section-head"><div><p className="eyebrow">AI Avatar</p><h2>Show each product on your photo</h2></div><span>Photo preview</span></div>
                  <div className="avatar-grid">
                    <div>
                      <label className="panel upload"><span>Upload your photo</span><input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; if (avatarPhoto.startsWith('blob:')) URL.revokeObjectURL(avatarPhoto); setAvatarPhoto(URL.createObjectURL(file)); setPreviewMessage(`AI styling preview ready for ${preview.name}.`); }} /></label>
                      <div className="preview-list">{products.map((item) => <button key={item._id} type="button" className={previewId === item._id ? 'preview preview-active' : 'preview'} onClick={() => { setPreviewId(item._id); setPreviewMessage(`AI styling preview updated for ${item.name}.`); }}><span>{item.name}</span><strong>{item.category}</strong></button>)}</div>
                    </div>
                    <div className="avatar-stage-column">
                      <div className="stage">
                        {avatarPhoto ? <img src={avatarPhoto} alt="Uploaded fashion preview" className="photo" /> : <div className="placeholder"><div className="silhouette" /><p>Upload your photo to preview the selected look.</p></div>}
                      </div>
                      <div className="panel note"><strong>AI styling note</strong><p>{previewMessage}</p></div>
                    </div>
                  </div>
                </section>


              </section>

              <section className="panel section site-footer">
                <div className="footer-reserved">
                  <p>All rights reserved by Fashin@2025</p>
                  <p>Email: <a href={`https://mail.google.com/mail/?view=cm&fs=1&to=${store.supportEmail}`} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{store.supportEmail}</a> | Phone: <a href={`https://wa.me/91${store.supportPhone}`} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{store.supportPhone}</a></p>
                  <p>Address: {store.storeAddress}</p>
                </div>
                <div className="footer-link-layout">
                  <div className="footer-link-block">
                    <h3>Useful Links</h3>
                    <div className="footer-link-grid footer-useful-grid">
                      {['Blog', 'Privacy', 'Terms', 'FAQs', 'Security', 'Contact', 'Partner', 'Seller', 'Deliver', 'Resources'].map((item) => (
                        <button key={item} type="button" className="footer-text-link">{item}</button>
                      ))}
                    </div>
                  </div>
                  <div className="footer-link-block footer-category-block">
                    <div className="footer-link-title-row">
                      <h3>Categories</h3>
                      <button type="button" className="footer-see-all" onClick={() => scrollToSection('products-section')}>see all</button>
                    </div>
                    <div className="footer-link-grid footer-category-grid">
                      {['Apparel', 'Footwear', 'Beauty essential'].map((item) => (
                        <button key={item} type="button" className="footer-text-link" onClick={() => scrollToSection('products-section')}>{item}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </>}
          </main>
    </div>
  );
}

export default App;
