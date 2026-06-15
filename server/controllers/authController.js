const jwt = require('jsonwebtoken');
const { User } = require('../models');

exports.login = async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const login = email || username;

    if (!login || !password) {
      return res.status(400).json({ message: 'Email/username and password are required' });
    }

    const { Op } = require('sequelize');
    const user = await User.findOne({
      where: { [Op.or]: [{ email: login }, { username: login }] },
    });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (user.status === 'INACTIVE') {
      return res.status(403).json({ message: 'Account is inactive' });
    }

    const isValid = await user.validatePassword(password);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
};

exports.me = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user', error: err.message });
  }
};
