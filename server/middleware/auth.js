const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const header = req.headers['authorization'];
  const token = header && header.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user)
    return res.status(401).json({ error: 'Not authenticated' });
  if (!roles.includes(req.user.role))
    return res.status(403).json({
      error: `Access denied. Required: ${roles.join(' or ')}`,
      yourRole: req.user.role,
    });
  next();
};

module.exports = { verifyToken, requireRole };
