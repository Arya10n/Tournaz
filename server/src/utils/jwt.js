import jwt from 'jsonwebtoken';

// Generate JWT for a user
export const generateToken = user => {
  // Payload with user info
  const payload = {
    userId: user._id,
    email: user.email,
    primaryRole: user.primaryRole,
    secondaryRoles: user.secondaryRoles || [],
    collegeId: user.collegeId,
    fullName: user.fullName,
    isEmailVerified: user.isEmailVerified,
  };

  // Generate token
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Verify JWT
export const verifyToken = token => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token. Please login again.');
    }
    throw new Error('Authentication failed.');
  }
};
