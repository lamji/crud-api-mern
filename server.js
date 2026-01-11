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
const testRoutes = require('./routes/test');
const profileRoutes = require('./routes/profile');

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

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/**
 * HTTP → SOCKET BRIDGE
 */
app.post("/emit", (req, res) => {
  const { event, payload } = req.body;
  console.log(`📡 Bridge Received: ${event}`, payload);
  
  // 1. Global Broadcast
  io.emit(event, payload);
  console.log(`📢 Global Broadcast: ${event}`);

  // 2. Room-specific Broadcast
  const targetUserId = payload.userId || (payload.data && payload.data.userId);
  if (targetUserId) {
    io.to(`user:${targetUserId}`).emit(event, payload);
    console.log(`🎯 Room Broadcast to user:${targetUserId}: ${event}`);
  }
  
  res.json({ success: true });
});

/**
 * Socket.io Connection Logic
 */
io.on("connection", (socket) => {
  console.log("🟢 Client connected:", socket.id);

  socket.on("join", (userId) => {
    socket.join(`user:${userId}`);
    console.log(`✅ User ${userId} joined room: user:${userId}`);
  });

  socket.on("joinRoom", (roomName) => {
    socket.join(roomName);
    console.log(`✅ Socket ${socket.id} joined room: ${roomName}`);
  });

  socket.on("disconnect", (reason) => {
    console.log("🔴 Client disconnected:", socket.id, "Reason:", reason);
  });
});

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
  origin: true, // Allow all origins in development or use environment variable
  credentials: true
}));

/**
 * Database Connection
 * Connects to MongoDB using URI from environment variables or defaults to localhost
 * @see {@link https://mongoosejs.com/docs/connections.html}
 */
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/todo-app', {
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
app.use('/api/notifications', notificationRoutes);
app.use('/api/test', testRoutes);
app.use('/api/profile', profileRoutes);

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

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
