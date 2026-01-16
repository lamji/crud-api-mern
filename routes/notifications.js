const express = require('express');
const { protect } = require('../middleware/auth');
const router = express.Router();
const {
  createNotificationValidation,
  createNotification,
  getNotifications,
  getNotificationById,
  markAsRead,
  markAllAsRead,
  deleteNotification
} = require('../controllers/notificationController');

// Apply authentication to all routes (allow all authenticated users)
router.use(protect);

// POST /api/notifications - Create a new notification
router.post('/', createNotificationValidation, createNotification);

// GET /api/notifications - Get all notifications with optional filters
// Query parameters: userId, type, status, read, page, limit
router.get('/', getNotifications);

// GET /api/notifications/:id - Get a single notification by ID
router.get('/:id', getNotificationById);

// PATCH /api/notifications/:id/read - Mark notification as read
router.patch('/:id/read', markAsRead);

// PATCH /api/notifications/mark-all-read - Mark all notifications as read
router.patch('/mark-all-read', markAllAsRead);

// DELETE /api/notifications/:id - Delete a notification
router.delete('/:id', deleteNotification);

module.exports = router;
