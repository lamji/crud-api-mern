const { validationResult } = require('express-validator');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');

/**
 * Handle user registration
 * - Validates request using express-validator's validationResult
 * - Checks for duplicate email
 * - Creates user (password hashed via User pre('save'))
 * - Returns JWT and public user fields
 */
async function register(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email',
      });
    }

    const user = await User.create({ name, email, password });

    const token = generateToken({ id: user._id });

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Handle user login
 * - Validates request
 * - Verifies credentials with User.findByCredentials
 * - Updates lastLogin
 * - Returns JWT and user info
 */
async function login(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    try {
      const user = await User.findByCredentials(email, password);

      user.lastLogin = new Date();
      await user.save();

      const token = generateToken({ id: user._id });

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
        },
      });
    } catch (err) {
      // Keep original error handling behavior
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }
  } catch (error) {
    return next(error);
  }
}

/**
 * Get current authenticated user profile
 * - Assumes `protect` middleware populated req.user
 */
async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user.id);

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Update user profile
 * - Validates optional name/email
 * - Uses findByIdAndUpdate with validators
 */
async function updateProfile(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { name, email } = req.body;
    const updateFields = {};

    if (name) updateFields.name = name;
    if (email) updateFields.email = email;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateFields,
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Handle guest login
 * - Uses environment variables for guest credentials
 * - Returns JWT and user info
 */
async function guestLogin(req, res, next) {
  try {
    const guestEmail = process.env.GUEST_EMAIL;
    const guestPassword = process.env.GUEST_PASSWORD;

    if (!guestEmail || !guestPassword) {
      return res.status(500).json({
        success: false,
        message: 'Guest credentials not configured',
      });
    }

    let user = await User.findOne({ email: guestEmail });
    
    if (!user) {
      // Create guest user if doesn't exist
      user = await User.create({
        name: 'Guest User',
        email: guestEmail,
        password: guestPassword,
        role: 'guest'
      });
    } else {
      // Verify password if user exists
      try {
        user = await User.findByCredentials(guestEmail, guestPassword);
      } catch (err) {
        return res.status(401).json({
          success: false,
          message: 'Guest credentials are invalid',
        });
      }
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken({ id: user._id });

    return res.status(200).json({
      success: true,
      message: 'Guest login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  guestLogin,
};
