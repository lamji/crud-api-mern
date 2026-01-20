/**
 * Core Dependencies
 */
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
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
const notificationRoutes = require('./routes/notifications');

/**
 * Utility Imports
 */
const { createSocketBridge } = require('./utils/socketBridge');
const { setupSocketHandlers } = require('./utils/socketHandlers');
const testRoutes = require('./routes/test');
const profileRoutes = require('./routes/profile');
const cartRoutes = require('./routes/cart');
const productRoutes = require('./routes/products');
const posRoutes = require('./routes/pos');
const paymentRoutes = require('./routes/payments');
const resumeRoutes = require('./routes/resume');

/**
 * Custom Middleware
 * @module middleware/errorHandler - Centralized error handling for all routes
 */
const errorHandler = require('./middleware/errorHandler');

/**
 * Initialize Express Application
 */
const app = express();
const server = http.createServer(app);

/**
 * Initialize Socket.io
 */
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// Make io instance globally available for helpers
global.io = io;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/**
 * HTTP → SOCKET BRIDGE
 */
app.post("/emit", createSocketBridge(io));

/**
 * Socket.io Connection Logic
 */
setupSocketHandlers(io);

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
// app.use(limiter);

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
  origin: true, // Allow all origins in development or use environment variable
  credentials: true
}));

/**
 * Database Connection
 * Connects to MongoDB using URI from environment variables or defaults to localhost
 * @see {@link https://mongoosejs.com/docs/connections.html}
 */
const db = mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/todo-app', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 50,        // Maximum number of sockets in the connection pool
  minPoolSize: 5,         // Minimum number of sockets in the connection pool
  maxIdleTimeMS: 30000,   // Close connections after 30s of inactivity
  serverSelectionTimeoutMS: 3000, // Reduced timeout for faster failure detection
  socketTimeoutMS: 10000,  // Reduced socket timeout
  connectTimeoutMS: 5000,  // Reduced connection timeout
  bufferCommands: false,   // Disable mongoose buffering
});

// Wait for MongoDB connection before starting server
db.then(() => {
  console.log('MongoDB connected successfully');
  
  /**
   * API Routes
   * Mounts route handlers under their respective paths
   */
  app.use('/api/auth', authRoutes);
  app.use('/api/todos', todoRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/test', testRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/pos', posRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/resume', resumeRoutes);

  /**
   * Error Handling Middleware
   * Global error handler for unhandled errors
   */
  app.use(errorHandler);

  /**
   * Health Check Endpoint
   * @route GET /api/health
   * @returns {Object} Server status information
   */
  app.get('/api/health', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Server is running with socket io',
      timestamp: new Date().toISOString()
    });
  });

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
   * Start Server
   * Starts the Express server on configured port
   */
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
})
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1); // Exit if DB connection fails
});
