const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Todo = require('../models/Todo');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// @desc    Get all todos for authenticated user
// @route   GET /api/todos
// @access  Private
router.get('/', [
  query('completed').optional().isBoolean().withMessage('Completed must be a boolean'),
  query('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Priority must be low, medium, or high'),
  query('category').optional().trim(),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], async (req, res, next) => {
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

    const { completed, priority, category, page = 1, limit = 10, sort = '-createdAt' } = req.query;

    // Build filter object
    const filter = { user: req.user.id };
    if (completed !== undefined) filter.completed = completed === 'true';
    if (priority) filter.priority = priority;
    if (category) filter.category = new RegExp(category, 'i');

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get todos with pagination
    const todos = await Todo.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'name email');

    // Get total count for pagination
    const total = await Todo.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: todos.length,
      total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      },
      data: todos
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get single todo
// @route   GET /api/todos/:id
// @access  Private
router.get('/:id', async (req, res, next) => {
  try {
    const todo = await Todo.findOne({
      _id: req.params.id,
      user: req.user.id
    }).populate('user', 'name email');

    if (!todo) {
      return res.status(404).json({
        success: false,
        message: 'Todo not found'
      });
    }

    res.status(200).json({
      success: true,
      data: todo
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Create new todo
// @route   POST /api/todos
// @access  Private
router.post('/', [
  body('title')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title is required and must be between 1 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot be more than 500 characters'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Priority must be low, medium, or high'),
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid date'),
  body('category')
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage('Category cannot be more than 30 characters')
], async (req, res, next) => {
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

    const { title, description, priority, dueDate, category } = req.body;

    const todo = await Todo.create({
      title,
      description,
      priority,
      dueDate,
      category,
      user: req.user.id
    });

    const populatedTodo = await Todo.findById(todo._id).populate('user', 'name email');

    res.status(201).json({
      success: true,
      message: 'Todo created successfully',
      data: populatedTodo
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Update todo
// @route   PUT /api/todos/:id
// @access  Private
router.put('/:id', [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot be more than 500 characters'),
  body('completed')
    .optional()
    .isBoolean()
    .withMessage('Completed must be a boolean'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Priority must be low, medium, or high'),
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid date'),
  body('category')
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage('Category cannot be more than 30 characters')
], async (req, res, next) => {
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

    const { title, description, completed, priority, dueDate, category } = req.body;

    // Build update object
    const updateFields = {};
    if (title !== undefined) updateFields.title = title;
    if (description !== undefined) updateFields.description = description;
    if (completed !== undefined) updateFields.completed = completed;
    if (priority !== undefined) updateFields.priority = priority;
    if (dueDate !== undefined) updateFields.dueDate = dueDate;
    if (category !== undefined) updateFields.category = category;

    const todo = await Todo.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      updateFields,
      { new: true, runValidators: true }
    ).populate('user', 'name email');

    if (!todo) {
      return res.status(404).json({
        success: false,
        message: 'Todo not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Todo updated successfully',
      data: todo
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Delete todo
// @route   DELETE /api/todos/:id
// @access  Private
router.delete('/:id', async (req, res, next) => {
  try {
    const todo = await Todo.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id
    });

    if (!todo) {
      return res.status(404).json({
        success: false,
        message: 'Todo not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Todo deleted successfully',
      data: {}
    });
  } catch (error) {
    next(error);
  }
});

// @desc    Get todo statistics
// @route   GET /api/todos/stats
// @access  Private
router.get('/stats/overview', async (req, res, next) => {
  try {
    const userId = req.user.id;

    const stats = await Todo.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: { $sum: { $cond: ['$completed', 1, 0] } },
          pending: { $sum: { $cond: ['$completed', 0, 1] } },
          high: { $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] } },
          medium: { $sum: { $cond: [{ $eq: ['$priority', 'medium'] }, 1, 0] } },
          low: { $sum: { $cond: [{ $eq: ['$priority', 'low'] }, 1, 0] } },
          overdue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $lt: ['$dueDate', new Date()] },
                    { $eq: ['$completed', false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const result = stats[0] || {
      total: 0,
      completed: 0,
      pending: 0,
      high: 0,
      medium: 0,
      low: 0,
      overdue: 0
    };

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
