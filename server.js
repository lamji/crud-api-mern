/**
 * Core Dependencies
 */
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

/**
 * Route Imports
 * @module routes/auth - Handles user authentication (register, login, profile)
 * @module routes/todos - Manages CRUD operations for todo items
 */
const authRoutes = require('./routes/auth');
const todoRoutes = require('./routes/todos');

/**
 * Custom Middleware
 * @module middleware/errorHandler - Centralized error handling for all routes
 */
const errorHandler = require('./middleware/errorHandler');

/**
 * Initialize Express Application
 */
const app = express();

/**
 * Security Middleware
 * @see {@link https://helmetjs.github.io/} - Secures Express apps with HTTP headers
 */
app.use(helmet());

/**
 * Rate limiting middleware to prevent abuse
 * - Limits each IP to 100 requests per 15-minute window
 * - Helps protect against brute force and DDoS attacks
 * Docs: https://www.npmjs.com/package/express-rate-limit
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

/**
 * CORS Configuration
 * Defines allowed frontend origins that can access this API.
 * @constant {string[]} allowedOrigins - List of permitted origins
 * @todo Move to environment variables for production (e.g., ALLOWED_ORIGINS)
 */
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://app.example.com',
  'https://admin.example.com',
  'https://staging.example.com',
];

/**
 * CORS Middleware
 * Configures Cross-Origin Resource Sharing with the following rules:
 * - Allows requests without Origin header (CLI/mobile/curl)
 * - Validates against allowedOrigins whitelist
 * - Enables credentials/cookies support
 * @see {@link https://github.com/expressjs/cors#configuration-options}
 */
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true // Enable credentials (cookies, authorization headers)
}));

/**
 * Request Parsing Middleware
 * - json: Parse JSON payloads (max 10MB)
 * - urlencoded: Parse URL-encoded data with extended syntax
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/**
 * Database Connection
 * Connects to MongoDB using URI from environment variables or defaults to localhost
 * @see {@link https://mongoosejs.com/docs/connections.html}
 */
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/todo-app', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

/**
 * API Routes
 * Mounts route handlers under their respective paths
 */
app.use('/api/auth', authRoutes);
app.use('/api/todos', todoRoutes);

/**
 * Health Check Endpoint
 * @route GET /api/health
 * @returns {Object} Server status information
 */
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

/**
 * Error Handling
 * Central error handler - must be after all other middleware/routes
 */
app.use(errorHandler);

/**
 * 404 Handler
 * Catch-all for undefined routes
 */
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

/**
 * Server Initialization
 * Starts the Express server on the specified port
 * @constant {number} PORT - Server port from environment or default 5000
 */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
