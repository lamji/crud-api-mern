const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const { register, login, getMe, updateProfile, guestLogin } = require('../controllers/authController');
const { validateRegister, validateLogin } = require('../validators/authValidator');

const router = express.Router();

// Router for authentication endpoints. Mounted at `/api/auth` in `server.js`.
// Notes on imports used here:
// - `express-validator`: declaratively validates request bodies (returns 400 on invalid input)
// - `User` model: Mongoose schema with password hashing (pre('save')) and helpers
// - `generateToken(payload)`: issues a signed JWT using `JWT_SECRET` and `JWT_EXPIRE` from `.env`
// - `protect` middleware: verifies `Authorization: Bearer <token>` and populates `req.user`

// @desc    Register user
// @route   POST /auth/register
// @access  Public
router.post('/register', validateRegister, register);

// @desc    Login user
// @route   POST /auth/login
// @access  Public
router.post('/login', validateLogin, login);

// @desc    Guest login
// @route   POST /auth/guest-login
// @access  Public
router.post('/guest-login', guestLogin);

module.exports = router;
