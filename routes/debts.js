const express = require('express');
const router = express.Router();
const {
  getDebts,
  getDebt,
  createDebt,
  updateDebt,
  deleteDebt,
  makePayment,
  getDebtSummary,
  getOverdueDebts,
  closeDebt
} = require('../controllers/debtsController');
const { protect } = require('../middleware/auth');
const {
  validateCreateDebt,
  validateUpdateDebt,
  validateMakePayment,
  validateObjectId,
  validatePagination,
  validateDebtFilters,
  validateCloseDebt
} = require('../middleware/validation');

// Apply authentication middleware to all routes
router.use(protect);

/**
 * Tested endpoints
 */

// @route   POST /api/debts
// @desc    Create new debt
// @access  Private
// @status  Passed
router.post('/', validateCreateDebt, createDebt);

// @route   GET /api/debts
// @desc    Get all debts for authenticated user
// @access  Private
// @status  Passed
router.get('/', validatePagination, validateDebtFilters, getDebts);

// @route   GET /api/debts/:id
// @desc    Get single debt
// @access  Private
// @status  Passed
router.get('/:id', validateObjectId, getDebt);

// @route   PUT /api/debts/:id
// @desc    Update debt
// @access  Private
// @status  Passed
router.put('/:id', validateObjectId, validateUpdateDebt, updateDebt);

// @route   POST /api/debts/:id/payment
// @desc    Make payment on debt
// @access  Private
// @status  Passed
router.post('/:id/payment', validateObjectId, validateMakePayment, makePayment);

// @route   GET /api/debts/:id/summary
// @desc    Get debt summary with analytics
// @access  Private
// status   Passed
router.get('/:id/summary', validateObjectId, getDebtSummary);

// @route   DELETE /api/debts/:id
// @desc    Delete debt
// @access  Private
// @status  Passed
router.delete('/:id', validateObjectId, deleteDebt);

// @route   POST /api/debts/:id/close
// @desc    Close a debt with remarks
// @access  Private
router.post('/:id/close', validateObjectId, validateCloseDebt, closeDebt);

/**
 * No need for now
 */

// @route   GET /api/debts/overdue
// @desc    Get overdue debts for authenticated user
// @access  Private
router.get('/overdue', getOverdueDebts);













module.exports = router;
