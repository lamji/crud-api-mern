const mongoose = require('mongoose');
const Debt = require('../models/Debt');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

// Example usage of the Debt Manager Schema

async function createExampleDebt() {
  try {
    // Assuming we have a user ID
    const userId = new mongoose.Types.ObjectId();

    // Create a new debt
    const newDebt = new Debt({
      bankName: "Chase Bank",
      totalLoanAmount: 50000,
      totalPaidAmount: 0,
      isOpen: true,
      loanStartDate: new Date('2024-01-01'),
      monthsToPay: 24,
      monthlyAmortization: 2500,
      dueDate: new Date('2026-01-01'),
      firstPayment: 2, // March (0-indexed, so 2 = March)
      user: userId
    });

    await newDebt.save();
    console.log('Debt created:', newDebt);

    // The payment schedule will be automatically generated
    console.log('Payment Schedule:', newDebt.paymentSchedule);
    console.log('Total Paid Percentage:', newDebt.totalPaidPercentage);
    console.log('Remaining Balance:', newDebt.remainingBalance);

    return newDebt;
  } catch (error) {
    console.error('Error creating debt:', error);
  }
}

async function createExampleTransaction(debtId, userId) {
  try {
    // Create a payment transaction
    const paymentTransaction = new Transaction({
      type: 'payment',
      amount: 2500,
      description: 'Monthly payment for March 2024',
      transactionDate: new Date(),
      details: {
        debt: debtId,
        paymentScheduleIndex: 0, // First payment
        bankReference: 'TXN123456789',
        paymentMethod: 'bank_transfer'
      },
      status: 'completed',
      user: userId
    });

    await paymentTransaction.save();
    console.log('Payment transaction created:', paymentTransaction);

    // Create a loan transaction (initial loan disbursement)
    const loanTransaction = new Transaction({
      type: 'loan',
      amount: 50000,
      description: 'Initial loan disbursement',
      transactionDate: new Date('2024-01-01'),
      details: {
        debt: debtId,
        bankReference: 'LOAN123456789',
        paymentMethod: 'bank_transfer'
      },
      status: 'completed',
      user: userId
    });

    await loanTransaction.save();
    console.log('Loan transaction created:', loanTransaction);

    return { paymentTransaction, loanTransaction };
  } catch (error) {
    console.error('Error creating transaction:', error);
  }
}

async function getDebtSummary(debtId) {
  try {
    const summary = await Transaction.getDebtSummary(debtId);
    console.log('Debt Summary:', summary);
    return summary;
  } catch (error) {
    console.error('Error getting debt summary:', error);
  }
}

async function getMonthlyPayments(userId, year, month) {
  try {
    const monthlyPayments = await Transaction.getMonthlyPayments(userId, year, month);
    console.log('Monthly Payments:', monthlyPayments);
    return monthlyPayments;
  } catch (error) {
    console.error('Error getting monthly payments:', error);
  }
}

async function updateDebtOverdueStatus(debtId) {
  try {
    const debt = await Debt.findById(debtId);
    if (debt) {
      debt.updateOverdueStatus();
      await debt.save();
      console.log('Updated debt overdue status:', debt);
    }
  } catch (error) {
    console.error('Error updating overdue status:', error);
  }
}

// Example data structure that would be returned by the API
const exampleDebtResponse = {
  _id: "507f1f77bcf86cd799439011",
  bankName: "Chase Bank",
  totalLoanAmount: 50000,
  totalPaidAmount: 2500,
  isOpen: true,
  totalPaidPercentage: 5, // Virtual field
  loanStartDate: "2024-01-01T00:00:00.000Z",
  monthsToPay: 24,
  monthlyAmortization: 2500,
  dueDate: "2026-01-01T00:00:00.000Z",
  isOverdue: false, // Virtual field
  firstPayment: 2,
  remainingBalance: 47500, // Virtual field
  paymentSchedule: [
    {
      dueDate: "2024-03-01T00:00:00.000Z",
      dueAmount: 2500,
      status: "paid"
    },
    {
      dueDate: "2024-04-01T00:00:00.000Z",
      dueAmount: 2500,
      status: "upcoming"
    },
    // ... more payments
  ],
  user: "507f1f77bcf86cd799439012",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-03-01T00:00:00.000Z"
};

const exampleTransactionResponse = {
  _id: "507f1f77bcf86cd799439013",
  type: "payment",
  amount: 2500,
  formattedAmount: "$2,500.00", // Virtual field
  description: "Monthly payment for March 2024",
  transactionDate: "2024-03-01T00:00:00.000Z",
  details: {
    debt: "507f1f77bcf86cd799439011",
    paymentScheduleIndex: 0,
    bankReference: "TXN123456789",
    paymentMethod: "bank_transfer"
  },
  status: "completed",
  user: "507f1f77bcf86cd799439012",
  createdAt: "2024-03-01T00:00:00.000Z",
  updatedAt: "2024-03-01T00:00:00.000Z"
};

module.exports = {
  createExampleDebt,
  createExampleTransaction,
  getDebtSummary,
  getMonthlyPayments,
  updateDebtOverdueStatus,
  exampleDebtResponse,
  exampleTransactionResponse
};
