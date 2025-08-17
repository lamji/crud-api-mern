const express = require('express');
const router = express.Router();
const {
  getTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getDebtTransactionSummary,
  getMonthlyTransactions,
  getTransactionAnalytics
} = require('../controllers/transactionsController');
const { protect } = require('../middleware/auth');
const {
  validateCreateTransaction,
  validateUpdateTransaction,
  validateObjectId,
  validateDebtId,
  validateMonthYear,
  validatePagination,
  validateTransactionFilters
} = require('../middleware/validation');

// Apply authentication middleware to all routes
router.use(protect);

// @route   GET /api/transactions/analytics
// @desc    Get transaction analytics
// @access  Private
router.get('/analytics', validateTransactionFilters, getTransactionAnalytics);

// @route   GET /api/transactions/monthly/:year/:month
// @desc    Get monthly transaction summary
// @access  Private
router.get('/monthly/:year/:month', validateMonthYear, getMonthlyTransactions);

// @route   GET /api/transactions/debt/:debtId/summary
// @desc    Get transaction summary for a debt
// @access  Private
router.get('/debt/:debtId/summary', validateDebtId, getDebtTransactionSummary);

// @route   GET /api/transactions
// @desc    Get all transactions for authenticated user
// @access  Private
router.get('/', validatePagination, validateTransactionFilters, getTransactions);

// @route   POST /api/transactions
// @desc    Create new transaction
// @access  Private
router.post('/', validateCreateTransaction, createTransaction);

// @route   GET /api/transactions/:id
// @desc    Get single transaction
// @access  Private
router.get('/:id', validateObjectId, getTransaction);

// @route   PUT /api/transactions/:id
// @desc    Update transaction
// @access  Private
router.put('/:id', validateObjectId, validateUpdateTransaction, updateTransaction);

// @route   DELETE /api/transactions/:id
// @desc    Delete transaction
// @access  Private
router.delete('/:id', validateObjectId, deleteTransaction);

module.exports = router;
