const { body, validationResult } = require('express-validator');
const Notification = require('../models/Notification');
const User = require('../models/User');

// Generate unique order ID with format: ORD-YYMMDD-HHMMSS-XXX
const generateOrderId = () => {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = (now.getMonth() + 1).toString().padStart(2, '0');
  const dd = now.getDate().toString().padStart(2, '0');
  const hh = now.getHours().toString().padStart(2, '0');
  const min = now.getMinutes().toString().padStart(2, '0');
  const ss = now.getSeconds().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `ORD-${yy}${mm}${dd}-${hh}${min}${ss}-${random}`;
};

// Generate unique tracking number with format: TRK-YYMMDD-HHMMSS-XXX
const generateTrackingNumber = () => {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = (now.getMonth() + 1).toString().padStart(2, '0');
  const dd = now.getDate().toString().padStart(2, '0');
  const hh = now.getHours().toString().padStart(2, '0');
  const min = now.getMinutes().toString().padStart(2, '0');
  const ss = now.getSeconds().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `TRK-${yy}${mm}${dd}-${hh}${min}${ss}-${random}`;
};

// Validation rules for creating a notification
const createNotificationValidation = [
  body('type')
    .notEmpty()
    .withMessage('Type is required')
    .isIn(['order', 'shipping', 'payment', 'promotion', 'delivery'])
    .withMessage('Type must be one of: order, shipping, payment, promotion, delivery'),
  
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 100 })
    .withMessage('Title cannot be more than 100 characters')
    .trim(),
  
  body('message')
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ max: 500 })
    .withMessage('Message cannot be more than 500 characters')
    .trim(),
  
  body('status')
    .optional()
    .isIn(['success', 'info', 'warning', 'error'])
    .withMessage('Status must be one of: success, info, warning, error'),
  
  body('amount')
    .optional()
    .isNumeric()
    .withMessage('Amount must be a number')
    .isFloat({ min: 0 })
    .withMessage('Amount cannot be negative'),
  
  body('items')
    .isArray({ min: 1 })
    .withMessage('Items must be an array with at least one item'),
  
  body('items.*.productId')
    .notEmpty()
    .withMessage('Product ID is required for each item')
    .trim(),
  
  body('items.*.productName')
    .notEmpty()
    .withMessage('Product name is required for each item')
    .isLength({ max: 200 })
    .withMessage('Product name cannot be more than 200 characters')
    .trim(),
  
  body('items.*.productImage')
    .optional()
    .trim(),
  
  body('items.*.productPrice')
    .notEmpty()
    .withMessage('Product price is required for each item')
    .isNumeric()
    .withMessage('Product price must be a number')
    .isFloat({ min: 0 })
    .withMessage('Product price cannot be negative'),
  
  body('items.*.productCategory')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Category name cannot be more than 50 characters')
    .trim(),
  
  body('items.*.quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1')
];

// POST /api/notifications - Create a new notification
const createNotification = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { 
      type, 
      title, 
      message, 
      status, 
      amount,
      items
    } = req.body;

    // Use authenticated user's ID from req.user (set by auth middleware)
    const userId = req.user.id;

    // Create notification
    const notification = new Notification({
      userId,
      type,
      title,
      message,
      status: status || 'info',
      amount,
      orderId: generateOrderId(),
      trackingNumber: generateTrackingNumber(),
      items: items || []
    });

    await notification.save();

    // Get notification without userId for response
    const responseNotification = await Notification.findById(notification._id, { userId: 0 });

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      data: responseNotification
    });

  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// GET /api/notifications - Get all notifications (with optional filters)
const getNotifications = async (req, res) => {
  try {
    const { type, status, read, page = 1, limit = 10 } = req.query;

    // Build filter object - always filter by authenticated user's ID
    const filter = { userId: req.user.id };
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (read !== undefined) filter.read = read === 'true';

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query with pagination - exclude userId from results
    const notifications = await Notification.find(filter, { userId: 0 })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination info
    const total = await Notification.countDocuments(filter);

    res.json({
      success: true,
      data: notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// GET /api/notifications/:id - Get a single notification
const getNotificationById = async (req, res) => {
  try {
    // First check ownership with userId included
    const notificationCheck = await Notification.findById(req.params.id);
    
    if (!notificationCheck) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Check if notification belongs to authenticated user
    if (notificationCheck.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this notification'
      });
    }

    // Now get the notification without userId
    const notification = await Notification.findById(req.params.id, { userId: 0 });

    res.json({
      success: true,
      data: notification
    });

  } catch (error) {
    console.error('Error fetching notification:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// PATCH /api/notifications/:id/read - Mark notification as read
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Check if notification belongs to authenticated user
    if (notification.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this notification'
      });
    }

    // Update notification and exclude userId from result
    const updatedNotification = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true, runValidators: true, projection: { userId: 0 } }
    );

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: updatedNotification
    });

  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// DELETE /api/notifications/:id - Delete a notification
const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Check if notification belongs to authenticated user
    if (notification.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this notification'
      });
    }

    await Notification.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// PATCH /api/notifications/mark-all-read - Mark all notifications as read for authenticated user
const markAllAsRead = async (req, res) => {
  try {
    // Update all notifications for the authenticated user
    const result = await Notification.updateMany(
      { userId: req.user.id, read: false },
      { read: true }
    );

    res.json({
      success: true,
      message: `Marked ${result.modifiedCount} notifications as read`,
      data: {
        modifiedCount: result.modifiedCount
      }
    });

  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  createNotificationValidation,
  createNotification,
  getNotifications,
  getNotificationById,
  markAsRead,
  markAllAsRead,
  deleteNotification
};
