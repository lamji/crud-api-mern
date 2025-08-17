const mongoose = require('mongoose');
const Debt = require('../models/Debt');
const Transaction = require('../models/Transaction');
const asyncHandler = require('express-async-handler');

// @desc    Get all debts for authenticated user
// @route   GET /api/debts
// @access  Private
const getDebts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, bankName, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  // Build filter object
  const filter = { user: req.user.id };
  
  if (status === 'open') filter.isOpen = true;
  if (status === 'closed') filter.isOpen = false;
  if (bankName) filter.bankName = { $regex: bankName, $options: 'i' };

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

  const debts = await Debt.find(filter)
    .sort(sort)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .populate('user', 'name email');

  const total = await Debt.countDocuments(filter);

  // Get open/closed stats
  const openDebts = await Debt.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(req.user.id), isOpen: true } },
    { 
      $group: {
        _id: null,
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalLoanAmount' }
      }
    }
  ]);

  const closedDebts = await Debt.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(req.user.id), isOpen: false } },
    { 
      $group: {
        _id: null,
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalLoanAmount' }
      }
    }
  ]);

  res.status(200).json({
    success: true,
    count: debts.length,
    total,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit)
    },
    data: debts,
    stats: {
      open: {
        count: openDebts[0]?.count || 0,
        totalAmount: openDebts[0]?.totalAmount || 0
      },
      closed: {
        count: closedDebts[0]?.count || 0,
        totalAmount: closedDebts[0]?.totalAmount || 0
      }
    }
  });
});

// @desc    Get single debt
// @route   GET /api/debts/:id
// @access  Private
const getDebt = asyncHandler(async (req, res) => {
  const debt = await Debt.findById(req.params.id).populate('user', 'name email');

  if (!debt) {
    res.status(404);
    throw new Error('Debt not found');
  }

  // Check if debt belongs to authenticated user
  if (debt.user._id.toString() !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to access this debt');
  }

  // Update overdue status before returning
  debt.updateOverdueStatus();
  await debt.save();

  res.status(200).json({
    success: true,
    data: debt
  });
});

// @desc    Create new debt
// @route   POST /api/debts
// @access  Private
const createDebt = asyncHandler(async (req, res) => {
  const {
    bankName,
    totalLoanAmount,
    loanStartDate,
    monthsToPay,
    monthlyAmortization,
    dueDate,
    firstPayment
  } = req.body;

  console.log(req.body);

  // Validate required fields
  if (!bankName || !totalLoanAmount || !loanStartDate || !monthsToPay || !monthlyAmortization || !dueDate || firstPayment === undefined) {
    res.status(400);
    throw new Error('Please provide all required fields');
  }

  // Validate firstPayment range
  if (firstPayment < 0 || firstPayment > 11) {
    res.status(400);
    throw new Error('First payment month must be between 0-11');
  }

  // Validate monthly amortization
  const regularMonths = monthsToPay - 1;
  const regularPayments = regularMonths * monthlyAmortization;
  if (regularPayments >= totalLoanAmount) {
    res.status(400);
    throw new Error(`Invalid monthly amortization. ${regularMonths} payments of ${monthlyAmortization} would exceed the total loan amount of ${totalLoanAmount}`);
  }

  // Create debt
  const debt = await Debt.create({
    bankName,
    totalLoanAmount,
    loanStartDate,
    monthsToPay,
    monthlyAmortization,
    dueDate,
    firstPayment,
    user: req.user.id
  });

  // Create initial loan transaction
  await Transaction.create({
    type: 'loan',
    amount: totalLoanAmount,
    description: `Initial loan disbursement from ${bankName}`,
    transactionDate: loanStartDate,
    details: {
      debt: debt._id,
      bankReference: `LOAN-${Date.now()}`,
      paymentMethod: 'bank_transfer'
    },
    status: 'completed',
    user: req.user.id
  });

  res.status(201).json({
    success: true,
    data: debt
  });
});

// @desc    Update debt
// @route   PUT /api/debts/:id
// @access  Private
const updateDebt = asyncHandler(async (req, res) => {
  let debt = await Debt.findById(req.params.id);

  if (!debt) {
    res.status(404);
    throw new Error('Debt not found');
  }

  // Check if debt belongs to authenticated user
  if (debt.user.toString() !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to update this debt');
  }

  // If updating monthly amortization, validate it
  if (req.body.monthlyAmortization) {
    // Count paid payments and calculate remaining balance
    const paidPayments = debt.paymentSchedule.filter(p => p.status === 'paid');
    const paidAmount = paidPayments.reduce((sum, p) => sum + p.dueAmount, 0);
    const remainingBalance = debt.totalLoanAmount - paidAmount;
    const remainingMonths = debt.monthsToPay - paidPayments.length;
    
    if (remainingMonths > 0) {
      const regularMonths = remainingMonths - 1;
      const regularPayments = regularMonths * req.body.monthlyAmortization;
      
      if (regularPayments >= remainingBalance) {
        res.status(400);
        throw new Error(`Invalid monthly amortization. ${regularMonths} payments of ${req.body.monthlyAmortization} would exceed the remaining balance of ${remainingBalance}`);
      }
    }
    
    // Add metadata for payment schedule recalculation
    req.body._paidPayments = paidPayments;
    req.body._remainingBalance = remainingBalance;
  }

  // Prevent updating certain fields if debt has payments
  if (debt.totalPaidAmount > 0) {
    const restrictedFields = ['totalLoanAmount', 'monthsToPay', 'firstPayment', 'loanStartDate'];
    const hasRestrictedUpdates = restrictedFields.some(field => req.body[field] !== undefined);
    
    if (hasRestrictedUpdates) {
      res.status(400);
      throw new Error('Cannot modify loan amount, months, or start date after payments have been made');
    }
  }

  const session = await mongoose.startSession();
  let success = false;
  try {
    // Get the debt document to modify it
    debt = await Debt.findById(req.params.id);
    const oldAmount = debt.monthlyAmortization;
    
    // Start transaction
    await session.startTransaction();
    
    // Update the fields
    Object.assign(debt, req.body);
    
    // Create transaction for the update
    await Transaction.create([{
      type: 'update',
      amount: debt.monthlyAmortization,
      description: `Updated debt details from ${req.body.monthlyAmortization ? `${oldAmount} to ${debt.monthlyAmortization}` : 'previous values'}`,
      details: {
        debt: debt._id,
        bankReference: debt.paymentSchedule[0]?.bankReference,
        paymentMethod: debt.paymentSchedule[0]?.paymentMethod
      },
      user: req.user.id
    }], { session });
    
    // Save to trigger the pre-save middleware that recalculates payment schedule
    await debt.save({ session });
    
    // Commit the transaction
    await session.commitTransaction();
    success = true;
  } catch (error) {
    if (!success) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    await session.endSession();
  }

  res.status(200).json({
    success: true,
    data: debt
  });
});

// @desc    Delete debt
// @route   DELETE /api/debts/:id
// @access  Private
const deleteDebt = asyncHandler(async (req, res) => {
  const debt = await Debt.findById(req.params.id);

  if (!debt) {
    res.status(404);
    throw new Error('Debt not found');
  }

  // Check if debt belongs to authenticated user
  if (debt.user.toString() !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to delete this debt');
  }

  // Delete associated transactions
  await Transaction.deleteMany({ 'details.debt': debt._id });

  await debt.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Debt deleted successfully'
  });
});

// @desc    Make payment on debt
// @route   POST /api/debts/:id/payment
// @access  Private
const makePayment = asyncHandler(async (req, res) => {
  const { 
    amount, 
    paymentScheduleIndex, 
    bankReference, 
    paymentMethod = 'bank_transfer', 
    description 
  } = req.body;


  let debt = await Debt.findById(req.params.id);

  if (!debt) {
    res.status(404);
    throw new Error('Debt not found');
  }

  // Check if debt belongs to authenticated user
  if (debt.user.toString() !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to make payment on this debt');
  }

  // Validate payment schedule index
  if (paymentScheduleIndex < 0 || paymentScheduleIndex >= debt.paymentSchedule.length) {
    res.status(400);
    throw new Error('Invalid payment schedule index');
  }

  // Check if payment is already made
  if (debt.paymentSchedule[paymentScheduleIndex].status === 'paid') {
    res.status(400);
    throw new Error('Payment already made for this schedule');
  }



  // Check if payment matches or exceeds schedule
  const scheduledAmount = debt.paymentSchedule[paymentScheduleIndex].dueAmount;
  if (amount > scheduledAmount) {
    res.status(400);
    throw new Error(`Payment amount ${amount} exceeds scheduled amount of ${scheduledAmount}`);
  } else if (amount < scheduledAmount) {
    res.status(400);
    throw new Error(`Payment amount ${amount} is less than scheduled amount of ${scheduledAmount}`);
  }

 

  // Validate required payment details
  if (!bankReference) {
    res.status(400);
    throw new Error('Bank reference is required');
  }

  const session = await mongoose.startSession();
  try {
    await session.startTransaction();
    
    // Get fresh copy of debt
    debt = await Debt.findById(debt._id).session(session);
    if (!debt) {
      throw new Error('Debt not found');
    }

    // Revalidate payment status
    if (debt.paymentSchedule[paymentScheduleIndex].status === 'paid') {
      throw new Error('Payment already made for this schedule');
    }
    
    // First update debt with payment details
    const paymentDetails = {
      bankReference,
      paymentMethod,
      description
    };
    console.log('PaymentDetails object:', paymentDetails);
    console.log('Variables:', { bankReference, paymentMethod, description });
    if (!paymentDetails.bankReference || !paymentDetails.paymentMethod) {
      throw new Error('Payment details are incomplete');
    }
    debt.makePayment(paymentScheduleIndex, amount, paymentDetails);
    await debt.save({ session });

    // Then create transaction record
    await Transaction.create([{
      type: 'payment',
      amount: amount,
      description: description || `Payment for schedule ${paymentScheduleIndex + 1}`,
      details: {
        debt: debt._id,
        paymentScheduleIndex,
        bankReference,
        paymentMethod
      },
      user: req.user.id
    }], { session });

    await session.commitTransaction();
    res.status(200).json({
      success: true,
      message: 'Payment recorded successfully',
      debt
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

// @desc    Get debt summary with analytics
// @route   GET /api/debts/:id/summary
// @access  Private
const getDebtSummary = asyncHandler(async (req, res) => {
  const debt = await Debt.findById(req.params.id);

  if (!debt) {
    res.status(404);
    throw new Error('Debt not found');
  }

  // Check if debt belongs to authenticated user
  if (debt.user.toString() !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to access this debt');
  }

  // Get transaction summary
  const transactionSummary = await Transaction.getDebtSummary(debt._id);

  // Calculate analytics
  const paidPayments = debt.paymentSchedule.filter(p => p.status === 'paid').length;
  const overduePayments = debt.paymentSchedule.filter(p => p.status === 'overdue').length;
  const upcomingPayments = debt.paymentSchedule.filter(p => p.status === 'upcoming').length;

  const summary = {
    debt,
    analytics: {
      totalPayments: debt.paymentSchedule.length,
      paidPayments,
      overduePayments,
      upcomingPayments,
      completionPercentage: Math.round((paidPayments / debt.paymentSchedule.length) * 100),
      nextPaymentDue: debt.paymentSchedule.find(p => p.status !== 'paid')?.dueDate || null
    },
    transactions: transactionSummary
  };

  res.status(200).json({
    success: true,
    data: summary
  });
});

// @desc    Get overdue debts for user
// @route   GET /api/debts/overdue
// @access  Private
const getOverdueDebts = asyncHandler(async (req, res) => {
  const debts = await Debt.find({
    user: req.user.id,
    isOpen: true,
    'paymentSchedule.status': 'overdue'
  });

  // Update overdue status for all debts
  for (let debt of debts) {
    debt.updateOverdueStatus();
    await debt.save();
  }

  res.status(200).json({
    success: true,
    count: debts.length,
    data: debts,
    stats: {
      open: {
        count: openDebts[0]?.count || 0,
        totalAmount: openDebts[0]?.totalAmount || 0
      },
      closed: {
        count: closedDebts[0]?.count || 0,
        totalAmount: closedDebts[0]?.totalAmount || 0
      }
    }
  });
});

// @desc    Close a debt
// @route   POST /api/debts/:id/close
// @access  Private
const closeDebt = asyncHandler(async (req, res) => {
  const { remarks } = req.body;
  let debt = await Debt.findById(req.params.id);

  if (!debt) {
    res.status(404);
    throw new Error('Debt not found');
  }

  // Check if debt belongs to authenticated user
  if (debt.user.toString() !== req.user.id) {
    res.status(403);
    throw new Error('Not authorized to close this debt');
  }

  // Check if debt is already closed
  if (!debt.isOpen) {
    res.status(400);
    throw new Error('Debt is already closed');
  }

  const session = await mongoose.startSession();
  try {
    await session.startTransaction();
    
    // Close the debt
    debt.isOpen = false;
    await debt.save({ session });

    // Create transaction record for closing
    await Transaction.create([{
      type: 'close',
      amount: debt.remainingBalance,
      description: remarks,
      details: {
        debt: debt._id,
        bankReference: `CLOSE-${Date.now()}`,
        paymentMethod: 'system'
      },
      user: req.user.id
    }], { session });

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: 'Debt closed successfully',
      data: debt
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

module.exports = {
  getDebts,
  getDebt,
  createDebt,
  updateDebt,
  deleteDebt,
  makePayment,
  getDebtSummary,
  getOverdueDebts,
  closeDebt
};
