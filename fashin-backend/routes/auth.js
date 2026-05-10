const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

function sanitizeUser(user) {
  return {
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    address: user.address || '',
    isAdmin: Boolean(user.isAdmin),
  };
}

function extractBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice(7);
}

module.exports = function createAuthRoutes({
  User,
  jwtSecret,
  isDbConnected,
  memoryUsers,
  getAdminBootstrapInfo,
  findUserByEmail,
}) {
  const router = express.Router();

  router.post('/signup', async (req, res) => {
    try {
      const { name, email, password, phone = '', address = '' } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ message: 'Name, email and password are required.' });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const existingUser = isDbConnected()
        ? await User.findOne({ email: normalizedEmail })
        : memoryUsers.find((user) => user.email === normalizedEmail);

      if (existingUser) {
        return res.status(409).json({ message: 'An account with this email already exists.' });
      }

      const adminBootstrap = await getAdminBootstrapInfo(normalizedEmail);
      const hashedPassword = await bcrypt.hash(password, 10);
      const userPayload = {
        name: name.trim(),
        email: normalizedEmail,
        phone: phone.trim(),
        address: address.trim(),
        isAdmin: adminBootstrap.isAdmin,
        password: hashedPassword,
        orders: [],
      };

      const user = isDbConnected()
        ? await User.create(userPayload)
        : (() => {
            memoryUsers.push(userPayload);
            return userPayload;
          })();

      const token = jwt.sign({ email: normalizedEmail, isAdmin: userPayload.isAdmin }, jwtSecret, { expiresIn: '7d' });
      return res.status(201).json({ token, user: sanitizeUser(user) });
    } catch (error) {
      return res.status(500).json({ message: 'Unable to create account right now.' });
    }
  });

  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const user = await findUserByEmail(normalizedEmail);

      if (!user) {
        return res.status(404).json({ message: 'No account found for this email.' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Incorrect password.' });
      }

      const token = jwt.sign({ email: normalizedEmail, isAdmin: Boolean(user.isAdmin) }, jwtSecret, { expiresIn: '7d' });
      return res.json({ token, user: sanitizeUser(user) });
    } catch (error) {
      return res.status(500).json({ message: 'Unable to sign in right now.' });
    }
  });

  router.get('/me', async (req, res) => {
    try {
      const token = extractBearerToken(req);
      if (!token) {
        return res.status(401).json({ message: 'Missing authentication token.' });
      }

      const decoded = jwt.verify(token, jwtSecret);
      const user = await findUserByEmail(decoded.email);

      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }

      return res.json({ user: sanitizeUser(user) });
    } catch (error) {
      return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
    }
  });

  return router;
};
