const { validationResult } = require('express-validator');
const Todo = require('../models/Todo');

/**
 * @desc    Get all todos for authenticated user with filtering and pagination
 * @route   GET /api/todos
 * @access  Private
 */
exports.getTodos = async (req, res, next) => {
  try {
    /**
     * Validate request using express-validator (validators are defined in the route)
     */
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    /**
     * Parse query params with defaults
     * - completed: string 'true'|'false' (converted below)
     * - priority: 'low'|'medium'|'high'
     * - category: partial, case-insensitive match
     * - page: number (default 1)
     * - limit: number (default 10)
     * - sort: mongoose sort string (default '-createdAt')
     *   - prefix with '-' for descending; omit for ascending
     */
    const { completed, priority, category, page = 1, limit = 10, sort = '-createdAt' } = req.query;

    /**
     * Base filter scoped to the authenticated user (set by auth middleware on req.user)
     */
    const filter = { user: req.user.id };
    /**
     * Apply optional filters: convert completed to boolean; use case-insensitive regex for category
     */
    if (completed !== undefined) filter.completed = completed === 'true';
    if (priority) filter.priority = priority;
    if (category) filter.category = new RegExp(category, 'i');

    /**
     * Compute pagination offset
     */
    const skip = (page - 1) * limit;

    /**
     * Fetch todos with filters, sort, pagination, and limited user fields
     */
    const todos = await Todo.find(filter)
    .select('-user')
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit));

    /**
     * Total count for the same filter (for pagination metadata)
     */
    const total = await Todo.countDocuments(filter);

    /**
     * Send response with pagination summary
     */
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
    /**
     * Delegate to centralized error handler
     */
    next(error);
  }
};

/**
 * @desc    Get single todo by ID
 * @route   GET /api/todos/:id
 * @access  Private
 */
exports.getTodo = async (req, res, next) => {
  try {
    /**
     * Query DB: find todo by id scoped to current user; populate 'user' with name and email only
     */
    const todo = await Todo.findOne({
      _id: req.params.id,
      user: req.user.id
    }).populate('user', 'name email');

    /**
     * Guard: if no todo found (doesn't exist or not owned by user), respond with 404
     */
    if (!todo) {
      return res.status(404).json({
        success: false,
        message: 'Todo not found'
      });
    }

    /**
     * Success: send the todo in response body
     */
    res.status(200).json({
      success: true,
      data: todo
    });
  } catch (error) {
    /**
     * Error path: pass error to global error handler
     */
    next(error);
  }
};



/**
 * @desc    Create new todo
 * @route   POST /api/todos
 * @access  Private
 */
exports.createTodo = async (req, res, next) => {
  try {
    /**
     * Validate request body
     */
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    /**
     * Extract allowed fields from request body
     */
    const { title, description, priority, dueDate, category } = req.body;

    /**
     * Create new todo tied to the authenticated user
     */
    const todo = await Todo.create({
      title,
      description,
      priority,
      dueDate,
      category,
      user: req.user.id
    });

    /**
     * Re-fetch to populate user fields on the created document
     */
    const populatedTodo = await Todo.findById(todo._id).populate('user', 'name email');

    /**
     * Send created resource
     */
    res.status(201).json({
      success: true,
      message: 'Todo created successfully',
      data: populatedTodo
    });
  } catch (error) {
    /**
     * Delegate to centralized error handler
     */
    next(error);
  }
};

/**
 * @desc    Update todo by ID
 * @route   PUT /api/todos/:id
 * @access  Private
 */
exports.updateTodo = async (req, res, next) => {
  try {
    /** Validate request body */
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    /**
     * Extract potential update fields
     */
    const { title, description, completed, priority, dueDate, category } = req.body;

    /**
     * Prepare only provided fields for update
     */
    const updateFields = {};
    if (title !== undefined) updateFields.title = title;
    if (description !== undefined) updateFields.description = description;
    if (completed !== undefined) updateFields.completed = completed;
    if (priority !== undefined) updateFields.priority = priority;
    if (dueDate !== undefined) updateFields.dueDate = dueDate;
    if (category !== undefined) updateFields.category = category;

    /**
     * Update todo for current user; return the new document and validate
     */
    const todo = await Todo.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      updateFields,
      { new: true, runValidators: true }
    ).populate('user', 'name email');

    /**
     * Handle not found
     */
    if (!todo) {
      return res.status(404).json({
        success: false,
        message: 'Todo not found'
      });
    }

    /**
     * Send updated resource
     */
    res.status(200).json({
      success: true,
      message: 'Todo updated successfully',
      data: todo
    });
  } catch (error) {
    /**
     * Delegate to centralized error handler
     */
    next(error);
  }
};

/**
 * @desc    Delete todo by ID
 * @route   DELETE /api/todos/:id
 * @access  Private
 */
exports.deleteTodo = async (req, res, next) => {
  try {
    /**
     * Delete todo for current user
     */
    const todo = await Todo.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id
    });

    /**
     * Handle not found
     */
    if (!todo) {
      return res.status(404).json({
        success: false,
        message: 'Todo not found'
      });
    }

    /**
     * Send deletion confirmation
     */
    res.status(200).json({
      success: true,
      message: 'Todo deleted successfully',
      data: {}
    });
  } catch (error) {
    /**
     * Delegate to centralized error handler
     */
    next(error);
  }
};

/**
 * @desc    Get todo statistics overview
 * @route   GET /api/todos/stats/overview
 * @access  Private
 */
exports.getTodoStats = async (req, res, next) => {
  try {
    /**
     * Current user id for scoping stats
     */
    const userId = req.user.id;

    /**
     * Aggregate stats for this user's todos
     */
    const stats = await Todo.aggregate([
      /**
       * Stage 1 - $match: filter docs to current user (WHERE user == userId)
       */
      { $match: { user: userId } },
      /**
       * Stage 2 - $group: compute aggregates in a single group
       */
      {
        $group: {
          /**
           * Group key: null -> single combined result
           */
          _id: null,
          /**
           * total: count all docs (sum 1 per doc)
           */
          total: { $sum: 1 },
          /**
           * completed: count where completed is true
           * $cond: [if, then, else]; '$completed' refers to document field
           */
          completed: { $sum: { $cond: ['$completed', 1, 0] } },
          /**
           * pending: count where completed is false
           */
          pending: { $sum: { $cond: ['$completed', 0, 1] } },
          /**
           * high: count todos where priority == 'high' using $eq
           */
          high: { $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] } },
          /**
           * medium: count todos where priority == 'medium'
           */
          medium: { $sum: { $cond: [{ $eq: ['$priority', 'medium'] }, 1, 0] } },
          /**
           * low: count todos where priority == 'low'
           */
          low: { $sum: { $cond: [{ $eq: ['$priority', 'low'] }, 1, 0] } },
          /**
           * overdue: dueDate < now AND completed == false
           * Uses $and, $lt, $eq inside $cond -> 1 if true else 0
           */
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

    /**
     * Fallback when no todos exist
     */
    const result = stats[0] || {
      total: 0,
      completed: 0,
      pending: 0,
      high: 0,
      medium: 0,
      low: 0,
      overdue: 0
    };

    /**
     * Send stats response
     */
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    /**
     * Delegate to centralized error handler
     */
    next(error);
  }
};
