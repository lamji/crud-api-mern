const { body, param, query, validationResult } = require('express-validator');

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Debt validation rules
const validateCreateDebt = [
  body('bankName')
    .notEmpty()
    .withMessage('Bank name is required')
    .isLength({ max: 100 })
    .withMessage('Bank name cannot exceed 100 characters')
    .trim(),
  
  body('totalLoanAmount')
    .isNumeric()
    .withMessage('Total loan amount must be a number')
    .isFloat({ min: 0.01 })
    .withMessage('Total loan amount must be greater than 0'),
  
  body('loanStartDate')
    .isISO8601()
    .withMessage('Loan start date must be a valid date')
    .toDate(),
  
  body('monthsToPay')
    .isInt({ min: 1, max: 600 })
    .withMessage('Months to pay must be between 1 and 600'),
  
  body('monthlyAmortization')
    .isNumeric()
    .withMessage('Monthly amortization must be a number')
    .isFloat({ min: 0.01 })
    .withMessage('Monthly amortization must be greater than 0'),
  
  body('dueDate')
    .isISO8601()
    .withMessage('Due date must be a valid date')
    .toDate(),
  
  body('firstPayment')
    .isInt({ min: 0, max: 11 })
    .withMessage('First payment must be between 0-11 (representing months)'),
  
  handleValidationErrors
];

const validateUpdateDebt = [
  body('bankName')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Bank name cannot exceed 100 characters')
    .trim(),
  
  body('totalLoanAmount')
    .optional()
    .isNumeric()
    .withMessage('Total loan amount must be a number')
    .isFloat({ min: 0.01 })
    .withMessage('Total loan amount must be greater than 0'),
  
  body('loanStartDate')
    .optional()
    .isISO8601()
    .withMessage('Loan start date must be a valid date')
    .toDate(),
  
  body('monthsToPay')
    .optional()
    .isInt({ min: 1, max: 600 })
    .withMessage('Months to pay must be between 1 and 600'),
  
  body('monthlyAmortization')
    .optional()
    .isNumeric()
    .withMessage('Monthly amortization must be a number')
    .isFloat({ min: 0.01 })
    .withMessage('Monthly amortization must be greater than 0'),
  
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid date')
    .toDate(),
  
  body('firstPayment')
    .optional()
    .isInt({ min: 0, max: 11 })
    .withMessage('First payment must be between 0-11 (representing months)'),
  
  handleValidationErrors
];

const validateMakePayment = [
  body('amount')
    .isNumeric()
    .withMessage('Payment amount must be a number')
    .isFloat({ min: 0.01 })
    .withMessage('Payment amount must be greater than 0'),
  
  body('paymentScheduleIndex')
    .isInt({ min: 0 })
    .withMessage('Payment schedule index must be a non-negative integer'),
  
  body('bankReference')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Bank reference cannot exceed 100 characters')
    .trim(),
  
  body('paymentMethod')
    .optional()
    .isIn(['bank_transfer', 'cash', 'check', 'online', 'auto_debit'])
    .withMessage('Invalid payment method'),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters')
    .trim(),
  
  handleValidationErrors
];

// Transaction validation rules
const validateCreateTransaction = [
  body('type')
    .isIn(['loan', 'payment'])
    .withMessage('Transaction type must be either "loan" or "payment"'),
  
  body('amount')
    .isNumeric()
    .withMessage('Amount must be a number')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters')
    .trim(),
  
  body('transactionDate')
    .optional()
    .isISO8601()
    .withMessage('Transaction date must be a valid date')
    .toDate(),
  
  body('details.debt')
    .isMongoId()
    .withMessage('Debt ID must be a valid MongoDB ObjectId'),
  
  body('details.paymentScheduleIndex')
    .if(body('type').equals('payment'))
    .isInt({ min: 0 })
    .withMessage('Payment schedule index is required for payment transactions and must be non-negative'),
  
  body('details.bankReference')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Bank reference cannot exceed 100 characters')
    .trim(),
  
  body('details.paymentMethod')
    .optional()
    .isIn(['bank_transfer', 'cash', 'check', 'online', 'auto_debit'])
    .withMessage('Invalid payment method'),
  
  body('status')
    .optional()
    .isIn(['pending', 'completed', 'failed', 'cancelled'])
    .withMessage('Invalid transaction status'),
  
  handleValidationErrors
];

const validateUpdateTransaction = [
  body('type')
    .optional()
    .isIn(['loan', 'payment'])
    .withMessage('Transaction type must be either "loan" or "payment"'),
  
  body('amount')
    .optional()
    .isNumeric()
    .withMessage('Amount must be a number')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters')
    .trim(),
  
  body('transactionDate')
    .optional()
    .isISO8601()
    .withMessage('Transaction date must be a valid date')
    .toDate(),
  
  body('details.bankReference')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Bank reference cannot exceed 100 characters')
    .trim(),
  
  body('details.paymentMethod')
    .optional()
    .isIn(['bank_transfer', 'cash', 'check', 'online', 'auto_debit'])
    .withMessage('Invalid payment method'),
  
  body('status')
    .optional()
    .isIn(['pending', 'completed', 'failed', 'cancelled'])
    .withMessage('Invalid transaction status'),
  
  handleValidationErrors
];

// Parameter validation
const validateObjectId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
  handleValidationErrors
];

const validateDebtId = [
  param('debtId')
    .isMongoId()
    .withMessage('Invalid debt ID format'),
  handleValidationErrors
];

const validateMonthYear = [
  param('year')
    .isInt({ min: 2000, max: 2100 })
    .withMessage('Year must be between 2000 and 2100'),
  param('month')
    .isInt({ min: 1, max: 12 })
    .withMessage('Month must be between 1 and 12'),
  handleValidationErrors
];

// Query validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'bankName', 'totalLoanAmount', 'dueDate', 'transactionDate', 'amount'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be "asc" or "desc"'),
  handleValidationErrors
];

const validateDebtFilters = [
  query('status')
    .optional()
    .isIn(['open', 'closed'])
    .withMessage('Status filter must be "open" or "closed"'),
  query('bankName')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Bank name filter cannot exceed 100 characters')
    .trim(),
  handleValidationErrors
];

const validateTransactionFilters = [
  query('type')
    .optional()
    .isIn(['loan', 'payment'])
    .withMessage('Type filter must be "loan" or "payment"'),
  query('status')
    .optional()
    .isIn(['pending', 'completed', 'failed', 'cancelled'])
    .withMessage('Invalid status filter'),
  query('debtId')
    .optional()
    .isMongoId()
    .withMessage('Debt ID filter must be a valid MongoDB ObjectId'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date')
    .toDate(),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date')
    .toDate(),
  handleValidationErrors
];

const validateCloseDebt = (req, res, next) => {
  const { remarks } = req.body;

  if (!remarks || typeof remarks !== 'string' || remarks.trim().length === 0) {
    res.status(400);
    throw new Error('Please provide remarks explaining why the debt is being closed');
  }

  next();
};

module.exports = {
  validateCreateDebt,
  validateUpdateDebt,
  validateMakePayment,
  validateCreateTransaction,
  validateUpdateTransaction,
  validateObjectId,
  validateDebtId,
  validateMonthYear,
  validatePagination,
  validateDebtFilters,
  validateCloseDebt,
  validateTransactionFilters,
  handleValidationErrors
};
