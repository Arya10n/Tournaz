import { verifyToken } from '../utils/jwt.js';

export const requireAuth = (req, res, next) => {
  try {
    // Get token
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    // Extract token
    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = verifyToken(token);

    // Add user to request object
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: error.message || 'Authentication failed',
    });
  }
};
