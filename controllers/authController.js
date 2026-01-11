const { validationResult } = require('express-validator');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { register, logout } = require('./auth');

/**
 * Handle user login
 * - Validates request
 * - Verifies credentials with User.findByCredentials
 * - Updates lastLogin atomically for concurrency safety
 * - Returns JWT and user info
 * - Optimized for high-volume requests
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
      // Find user and verify credentials
      const user = await User.findByCredentials(email, password);

      // Update lastLogin atomically for concurrency safety
      await User.findByIdAndUpdate(
        user._id,
        { $set: { lastLogin: new Date() } },
        { new: true }
      );

      const token = generateToken({ 
        id: user._id,
        role: user.role 
      });

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          name: user.name,
          email: user.email,
          role: user.role,
          lastLogin: new Date(),
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
 * - Uses lean queries for performance
 * - Optimized for high-volume requests
 */
async function getMe(req, res, next) {
  try {
    const userId = req.user.id;
    
    // Use lean query for better performance
    const user = await User.findById(userId).lean();
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userData = {
      name: user.name,
      email: user.email,
      role: user.role,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
    };

    return res.status(200).json({
      success: true,
      user: userData,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Update user profile
 * - Validates optional name/email
 * - Uses atomic findByIdAndUpdate for concurrency safety
 * - Optimized for high-volume requests
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

    // Atomic update for concurrency safety
    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateFields,
      { new: true, runValidators: true }
    ).lean();

    const userData = {
      name: user.name,
      email: user.email,
      role: user.role,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
    };

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: userData,
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Handle guest login
 * - Uses environment variables for guest credentials
 * - Returns JWT and user info
 * - Optimized for high-volume guest access
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

    // Use lean query for better performance
    let user = await User.findOne({ email: guestEmail }).lean();
    
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

    // Update lastLogin atomically
    await User.findByIdAndUpdate(
      user._id,
      { $set: { lastLogin: new Date() } }
    );

    const token = generateToken({ 
      id: user._id,
      role: user.role 
    });

    return res.status(200).json({
      success: true,
      message: 'Guest login successful',
      token,
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        lastLogin: new Date(),
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
  logout,
};
