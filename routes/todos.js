const express = require('express');
const { body, query } = require('express-validator');
const { protect } = require('../middleware/auth');
const {
  getTodos,
  getTodo,
  createTodo,
  updateTodo,
  deleteTodo,
  getTodoStats
} = require('../controllers/todosController');

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

/**
 * @route   GET /api/todos
 * @desc    Get all todos for authenticated user
 * @access  Private
 */
router.get('/', [
  // Validate query params for filtering and pagination
  // Docs: https://express-validator.github.io/docs/guides/validation-chain
  
  // completed: optional boolean filter
  query('completed')
    .optional()
    .isBoolean()
    .withMessage('Completed must be a boolean'),
  
  // priority: optional enum filter ('low' | 'medium' | 'high')
  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Priority must be low, medium, or high'),
  
  // category: optional string, trimmed
  query('category')
    .optional()
    .trim(),
  
  // page: optional positive integer
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  // limit: optional integer between 1 and 100
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
], getTodos);

/**
 * @route   GET /api/todos/:id
 * @desc    Get single todo
 * @access  Private
 */
router.get('/:id', getTodo);

/**
 * @route   POST /api/todos
 * @desc    Create new todo
 * @access  Private
 */
router.post('/', [
  // Validate and sanitize request body for creating a todo
  // Docs: https://express-validator.github.io/docs/guides/validation-chain

  // title: required; trim; 1-100 characters
  body('title')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title is required and must be between 1 and 100 characters'),

  // description: optional; trim; max 500 characters
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot be more than 500 characters'),

  // priority: optional; one of 'low' | 'medium' | 'high'
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Priority must be low, medium, or high'),

  // dueDate: optional; valid ISO 8601 date
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid date'),

  // category: optional; trim; max 30 characters
  body('category')
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage('Category cannot be more than 30 characters')
], createTodo);

/**
 * @route   PUT /api/todos/:id
 * @desc    Update todo
 * @access  Private
 */
router.put('/:id', [
  // All fields are optional for partial updates; rules apply only if provided.

  // Validate and sanitize `title` (optional field)
  // - optional(): only validate if provided
  // - trim(): remove leading/trailing spaces
  // - isLength({ min: 1, max: 100 }): require 1 to 100 characters
  // Docs: https://express-validator.github.io/docs/guides/validation-chain
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters'),
  
  // Validate and sanitize `description` (optional field)
  // - optional(): only validate if provided
  // - trim(): remove leading/trailing spaces
  // - isLength({ max: 500 }): maximum 500 characters
  // Docs: https://express-validator.github.io/docs/guides/validation-chain
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot be more than 500 characters'),
  
  // Validate `completed` (optional field)
  // - optional(): only validate if provided
  // - isBoolean(): must be true or false
  // Docs: https://express-validator.github.io/docs/guides/validation-chain
  body('completed')
    .optional()
    .isBoolean()
    .withMessage('Completed must be a boolean'),
  
  // Validate `priority` (optional field)
  // - optional(): only validate if provided
  // - isIn(['low', 'medium', 'high']): enforce allowed values
  // Docs: https://express-validator.github.io/docs/guides/validation-chain
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Priority must be low, medium, or high'),
  
  // Validate `dueDate` (optional field)
  // - optional(): only validate if provided
  // - isISO8601(): must be a valid ISO 8601 date string
  // Docs: https://express-validator.github.io/docs/guides/validation-chain
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid date'),
  
  // Validate and sanitize `category` (optional field)
  // - optional(): only validate if provided
  // - trim(): remove leading/trailing spaces
  // - isLength({ max: 30 }): maximum 30 characters
  // Docs: https://express-validator.github.io/docs/guides/validation-chain
  body('category')
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage('Category cannot be more than 30 characters')
], updateTodo);

/**
 * @route   DELETE /api/todos/:id
 * @desc    Delete todo
 * @access  Private
 */
router.delete('/:id', deleteTodo);

/**
 * @route   GET /api/todos/stats/overview
 * @desc    Get todo statistics
 * @access  Private
 */
router.get('/stats/overview', getTodoStats);

module.exports = router;
