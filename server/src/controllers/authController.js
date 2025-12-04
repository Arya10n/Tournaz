import User from '../models/user.js';
import { generateToken } from '../utils/jwt.js';

// Register a new user
export const register = async (req, res) => {
  try {
    const { email, password, collegeId, fullName, department, yearOfStudy } =
      req.body;

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email }, { collegeId }],
    });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists',
      });
    }

    // Create new user
    const user = new User({
      email,
      password,
      collegeId,
      fullName,
      department,
      yearOfStudy,
      primaryRole: 'student',
      isEmailVerified: false,
    });

    // save user to Db
    await user.save();

    // Generate JWT token
    const token = generateToken(user);

    // Return user data
    const userResponse = {
      _id: user._id,
      email: user.email,
      collegeId: user.collegeId,
      fullName: user.fullName,
      primaryRole: user.primaryRole,
      department: user.department,
      yearOfStudy: user.yearOfStudy,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
    };

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: userResponse,
        token,
      },
    });
  } catch (error) {
    // Mongoose validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors,
      });
    }

    // Duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Email or College ID already registered',
      });
    }

    // Generic server error
    res.status(500).json({
      success: false,
      error: 'Registration failed. Please try again.',
      details:
        process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Login user
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: 'Account is deactivated. Please contact admin.',
      });
    }

    // Verify password
    const isPassowrdValid = await user.comparePassword(password);

    if (!isPassowrdValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    // Update last login
    user.lastLogin = new Date();
    user.loginCount += 1;
    await user.save({ validateBeforeSave: false });

    // Generate JWT token
    const token = generateToken(user);

    // Return user data
    const userResponse = {
      _id: user._id,
      email: user.email,
      collegeId: user.collegeId,
      fullName: user.fullName,
      primaryRole: user.primaryRole,
      secondaryRoles: user.secondaryRoles,
      department: user.department,
      yearOfStudy: user.yearOfStudy,
      isEmailVerified: user.isEmailVerified,
      profilePicture: user.profilePicture,
      teams: user.teams,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
    };

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        token,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.',
      details:
        process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get current user
export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select(
      '-password -emailVerificationToken -passwordResetToken'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile',
    });
  }
};

// Logout user
export const logout = (req, res) => {
  // Logout is handled client side
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};
