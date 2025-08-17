const Transaction = require('../models/Transaction');
const Debt = require('../models/Debt');
const asyncHandler = require('express-async-handler');

// @desc    Get all transactions for authenticated user
// @route   GET /api/transactions
// @access  Private
const getTransactions = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    type, 
    status, 
    debtId, 
    startDate, 
    endDate,
    sortBy = 'transactionDate', 
    sortOrder = 'desc' 
  } = req.query;

  // Build filter object
  const filter = { user: req.user.id };
  
  if (type) filter.type = type;
  if (status) filter.status = status;
  if (debtId) filter['details.debt'] = debtId;
  
  // Date range filter
  if (startDate || endDate) {
    filter.transactionDate = {};
    if (startDate) filter.transactionDate.$gte = new Date(startDate);
    if (endDate) filter.transactionDate.$lte = new Date(endDate);
  }

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  const transactions = await Transaction.find(filter)
    .sort(sort)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .populate('details.debt', 'bankName totalLoanAmount')
    .populate('user', 'name email');

  const total = await Transaction.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: transactions.length,
    total,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit)
    },
    data: transactions
  });
});

// @desc    Get single transaction
// @route   GET /api/transactions/:id
// @access  Private
const getTransaction = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findById(req.params.id)
    .populate('details.debt', 'bankName totalLoanAmount monthlyAmortization')
    .populate('user', 'name email');

  if (!transaction) {
    res.status(404);
    throw new Error('Transaction not found');
  }

  // Check if transaction belongs to authenticated user
  if (transaction.user._id.toString() !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to access this transaction');
  }

  res.status(200).json({
    success: true,
    data: transaction
  });
});

// @desc    Create new transaction
// @route   POST /api/transactions
// @access  Private
const createTransaction = asyncHandler(async (req, res) => {
  const {
    type,
    amount,
    description,
    transactionDate,
    details,
    status = 'completed'
  } = req.body;

  // Validate required fields
  if (!type || !amount || !details || !details.debt) {
    res.status(400);
    throw new Error('Please provide type, amount, and debt details');
  }

  // Verify debt exists and belongs to user
  const debt = await Debt.findById(details.debt);
  if (!debt) {
    res.status(404);
    throw new Error('Associated debt not found');
  }

  if (debt.user.toString() !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to create transaction for this debt');
  }

  // Additional validation for payment transactions
  if (type === 'payment') {
    if (details.paymentScheduleIndex === undefined || details.paymentScheduleIndex < 0) {
      res.status(400);
      throw new Error('Payment schedule index is required for payment transactions');
    }

    if (details.paymentScheduleIndex >= debt.paymentSchedule.length) {
      res.status(400);
      throw new Error('Invalid payment schedule index');
    }

    // Check if payment is already made
    if (debt.paymentSchedule[details.paymentScheduleIndex].status === 'paid') {
      res.status(400);
      throw new Error('Payment for this schedule is already completed');
    }
  }

  // Create transaction
  const transaction = await Transaction.create({
    type,
    amount,
    description,
    transactionDate: transactionDate || new Date(),
    details: {
      ...details,
      bankReference: details.bankReference || `${type.toUpperCase()}-${Date.now()}`,
      paymentMethod: details.paymentMethod || 'bank_transfer'
    },
    status,
    user: req.user.id
  });

  // Populate the created transaction
  await transaction.populate('details.debt', 'bankName totalLoanAmount');

  res.status(201).json({
    success: true,
    data: transaction
  });
});

// @desc    Update transaction
// @route   PUT /api/transactions/:id
// @access  Private
const updateTransaction = asyncHandler(async (req, res) => {
  let transaction = await Transaction.findById(req.params.id);

  if (!transaction) {
    res.status(404);
    throw new Error('Transaction not found');
  }

  // Check if transaction belongs to authenticated user
  if (transaction.user.toString() !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to update this transaction');
  }

  // Prevent updating completed payment transactions that have already updated debt
  if (transaction.type === 'payment' && transaction.status === 'completed') {
    const allowedFields = ['description', 'details.bankReference'];
    const hasRestrictedUpdates = Object.keys(req.body).some(field => 
      !allowedFields.includes(field) && 
      !field.startsWith('details.bankReference')
    );
    
    if (hasRestrictedUpdates) {
      res.status(400);
      throw new Error('Cannot modify completed payment transactions except description and bank reference');
    }
  }

  transaction = await Transaction.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  }).populate('details.debt', 'bankName totalLoanAmount');

  res.status(200).json({
    success: true,
    data: transaction
  });
});

// @desc    Delete transaction
// @route   DELETE /api/transactions/:id
// @access  Private
const deleteTransaction = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findById(req.params.id);

  if (!transaction) {
    res.status(404);
    throw new Error('Transaction not found');
  }

  // Check if transaction belongs to authenticated user
  if (transaction.user.toString() !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to delete this transaction');
  }

  // Prevent deleting completed payment transactions
  if (transaction.type === 'payment' && transaction.status === 'completed') {
    res.status(400);
    throw new Error('Cannot delete completed payment transactions. This would affect debt calculations.');
  }

  await transaction.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Transaction deleted successfully'
  });
});

// @desc    Get transaction summary for a debt
// @route   GET /api/transactions/debt/:debtId/summary
// @access  Private
const getDebtTransactionSummary = asyncHandler(async (req, res) => {
  const { debtId } = req.params;

  // Verify debt exists and belongs to user
  const debt = await Debt.findById(debtId);
  if (!debt) {
    res.status(404);
    throw new Error('Debt not found');
  }

  if (debt.user.toString() !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to access this debt');
  }

  const summary = await Transaction.getDebtSummary(debtId);

  res.status(200).json({
    success: true,
    data: {
      debtId,
      bankName: debt.bankName,
      summary
    }
  });
});

// @desc    Get monthly transaction summary
// @route   GET /api/transactions/monthly/:year/:month
// @access  Private
const getMonthlyTransactions = asyncHandler(async (req, res) => {
  const { year, month } = req.params;

  if (!year || !month || month < 1 || month > 12) {
    res.status(400);
    throw new Error('Please provide valid year and month (1-12)');
  }

  const transactions = await Transaction.getMonthlyPayments(req.user.id, parseInt(year), parseInt(month));

  // Calculate monthly summary
  const summary = {
    totalPayments: 0,
    totalAmount: 0,
    transactionCount: transactions.length,
    byPaymentMethod: {},
    byBank: {}
  };

  transactions.forEach(transaction => {
    if (transaction.type === 'payment') {
      summary.totalPayments++;
      summary.totalAmount += transaction.amount;
    }

    // Group by payment method
    const method = transaction.details.paymentMethod;
    summary.byPaymentMethod[method] = (summary.byPaymentMethod[method] || 0) + transaction.amount;

    // Group by bank
    const bankName = transaction.details.debt?.bankName || 'Unknown';
    summary.byBank[bankName] = (summary.byBank[bankName] || 0) + transaction.amount;
  });

  res.status(200).json({
    success: true,
    data: {
      year: parseInt(year),
      month: parseInt(month),
      summary,
      transactions
    }
  });
});

// @desc    Get transaction analytics
// @route   GET /api/transactions/analytics
// @access  Private
const getTransactionAnalytics = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  // Default to last 12 months if no dates provided
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate ? new Date(startDate) : new Date(end.getFullYear() - 1, end.getMonth(), end.getDate());

  const analytics = await Transaction.aggregate([
    {
      $match: {
        user: req.user._id,
        transactionDate: { $gte: start, $lte: end }
      }
    },
    {
      $group: {
        _id: {
          type: '$type',
          year: { $year: '$transactionDate' },
          month: { $month: '$transactionDate' }
        },
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 }
    }
  ]);

  res.status(200).json({
    success: true,
    data: {
      period: { start, end },
      analytics
    }
  });
});

module.exports = {
  getTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getDebtTransactionSummary,
  getMonthlyTransactions,
  getTransactionAnalytics
};
