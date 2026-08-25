const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const createToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      role: user.role,
      email: user.email,
    },
    process.env.JWT_SECRET || 'SnapMart_JWT_Secret_2024_8f3c9a1b2d5e7f90a1b2c3d4e5f6a7b8',
    { expiresIn: '7d' }
  );

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
});

exports.register = async (req, res) => {
  try {
    const { name, email, password, role = 'user', adminKey } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: 'A user with that email already exists.' });
    }

    const isAdminRequest = role === 'admin';
    if (isAdminRequest) {
      const configuredAdminKey = (process.env.ADMIN_SIGNUP_KEY || 'admin123').trim();
      const submittedAdminKey = typeof adminKey === 'string' ? adminKey.trim() : '';

      if (configuredAdminKey !== submittedAdminKey) {
        return res.status(403).json({
          message: 'Admin signup requires a valid server admin key. Use the configured admin key to continue.',
        });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: isAdminRequest ? 'admin' : 'user',
    });

    const token = createToken(user);

    return res.status(201).json({
      message: 'Registration successful',
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Registration failed', error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = createToken(user);

    return res.json({
      message: 'Login successful',
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Login failed', error: error.message });
  }
};
