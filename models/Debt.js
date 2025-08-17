const mongoose = require('mongoose');

const paymentScheduleSchema = new mongoose.Schema({
  dueDate: {
    type: Date,
    required: true
  },
  dueAmount: {
    type: Number,
    required: true,
    min: [0, 'Due amount cannot be negative']
  },
  status: {
    type: String,
    enum: ['paid', 'overdue', 'upcoming'],
    default: 'upcoming'
  },
  bankReference: {
    type: String,
    trim: true
  },
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'cash', 'check', 'online'],
    trim: true
  },
  paymentDate: Date,
  description: String
}, { _id: false });

const debtSchema = new mongoose.Schema({
  bankName: {
    type: String,
    required: [true, 'Please provide a bank name'],
    trim: true,
    maxlength: [100, 'Bank name cannot be more than 100 characters']
  },
  totalLoanAmount: {
    type: Number,
    required: [true, 'Please provide total loan amount'],
    min: [0, 'Total loan amount cannot be negative']
  },
  totalPaidAmount: {
    type: Number,
    default: 0,
    min: [0, 'Total paid amount cannot be negative']
  },
  isOpen: {
    type: Boolean,
    default: true
  },
  loanStartDate: {
    type: Date,
    required: [true, 'Please provide loan start date']
  },
  monthsToPay: {
    type: Number,
    required: [true, 'Please provide number of months to pay'],
    min: [1, 'Months to pay must be at least 1']
  },
  monthlyAmortization: {
    type: Number,
    required: [true, 'Please provide monthly amortization amount'],
    min: [0, 'Monthly amortization cannot be negative']
  },
  dueDate: {
    type: Date,
    required: [true, 'Please provide due date']
  },
  firstPayment: {
    type: Number,
    required: [true, 'Please provide first payment month (0-11)'],
    min: [0, 'First payment month must be between 0-11'],
    max: [11, 'First payment month must be between 0-11']
  },
  paymentSchedule: [paymentScheduleSchema],
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Virtual for total paid percentage
debtSchema.virtual('totalPaidPercentage').get(function() {
  if (this.totalLoanAmount === 0) return 0;
  return Math.min(100, Math.round((this.totalPaidAmount / this.totalLoanAmount) * 100));
});

// Virtual for checking if debt is overdue
debtSchema.virtual('isOverdue').get(function() {
  if (!this.isOpen) return false;
  return this.paymentSchedule.some(payment => payment.status === 'overdue');
});

// Virtual for remaining balance
debtSchema.virtual('remainingBalance').get(function() {
  return Math.max(0, this.totalLoanAmount - this.totalPaidAmount);
});

// Pre-save middleware to generate payment schedule
debtSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('monthsToPay') || this.isModified('firstPayment') || this.isModified('monthlyAmortization') || this.isModified('loanStartDate')) {
    const startDate = new Date(this.loanStartDate);
    const firstPaymentMonth = this.firstPayment;
    
    // Handle paid payments if they exist
    if (this._paidPayments && this._paidPayments.length > 0) {
      const newSchedule = [];
      const remainingMonths = this.monthsToPay - this._paidPayments.length;
      
      // First, add all paid payments (preserve their original state and payment details)
      this._paidPayments.forEach(payment => {
        newSchedule.push({
          dueDate: payment.dueDate,
          dueAmount: payment.dueAmount,
          status: 'paid',
          bankReference: payment.bankReference,
          paymentMethod: payment.paymentMethod,
          paymentDate: payment.paymentDate,
          description: payment.description
        });
      });
      
      // Then calculate remaining payments
      if (remainingMonths > 0) {
        const regularMonths = remainingMonths - 1;
        const regularPayments = regularMonths * this.monthlyAmortization;
        const lastPayment = this._remainingBalance - regularPayments;
        
        // Add remaining unpaid payments
        for (let i = this._paidPayments.length; i < this.monthsToPay; i++) {
          const paymentDate = new Date(startDate);
          paymentDate.setMonth(startDate.getMonth() + firstPaymentMonth + i);
          
          const now = new Date();
          const fiveDaysBefore = new Date(paymentDate);
          fiveDaysBefore.setDate(fiveDaysBefore.getDate() - 5);
          
          let status = 'upcoming';
          if (paymentDate < now) {
            status = 'overdue';
          } else if (fiveDaysBefore <= now) {
            status = 'upcoming';
          }
          
          const dueAmount = i === this.monthsToPay - 1 ? lastPayment : this.monthlyAmortization;
          const oldPayment = this.paymentSchedule[i] || {};
          
          newSchedule.push({
            dueDate: paymentDate,
            dueAmount,
            status,
            bankReference: oldPayment.bankReference,
            paymentMethod: oldPayment.paymentMethod,
            paymentDate: oldPayment.paymentDate,
            description: oldPayment.description
          });
        }
      }
      
      this.paymentSchedule = newSchedule;
    } else {
      // Default behavior for new debts or no paid payments
      const oldSchedule = this.paymentSchedule || [];
      this.paymentSchedule = [];
      
      const regularMonths = this.monthsToPay - 1;
      const regularPayments = regularMonths * this.monthlyAmortization;
      const lastPayment = this.totalLoanAmount - regularPayments;

      if (regularPayments >= this.totalLoanAmount) {
        throw new Error(`Invalid monthly amortization. ${regularMonths} payments of ${this.monthlyAmortization} would exceed the total loan amount of ${this.totalLoanAmount}`);
      }

      for (let i = 0; i < this.monthsToPay; i++) {
        const paymentDate = new Date(startDate);
        paymentDate.setMonth(startDate.getMonth() + firstPaymentMonth + i);
        
        const now = new Date();
        const fiveDaysBefore = new Date(paymentDate);
        fiveDaysBefore.setDate(fiveDaysBefore.getDate() - 5);
        
        let status = 'upcoming';
        if (paymentDate < now) {
          status = 'overdue';
        } else if (fiveDaysBefore <= now) {
          status = 'upcoming';
        }
        const dueAmount = i === this.monthsToPay - 1 ? lastPayment : this.monthlyAmortization;
        const oldPayment = oldSchedule[i] || {};
        
        this.paymentSchedule.push({
          dueDate: paymentDate,
          dueAmount: dueAmount,
          status: oldPayment.status || status,
          bankReference: oldPayment.bankReference,
          paymentMethod: oldPayment.paymentMethod,
          paymentDate: oldPayment.paymentDate,
          description: oldPayment.description
        });
      }
    }
  }
  next();
});

// Method to update payment status
debtSchema.methods.makePayment = function(paymentIndex, amount, paymentDetails) {
  console.log('makePayment called with:', { paymentIndex, amount, paymentDetails });
  if (!paymentDetails || typeof paymentDetails !== 'object') {
    console.log('PaymentDetails validation failed:', paymentDetails, typeof paymentDetails);
    throw new Error('Payment details object is required');
  }
  if (paymentIndex >= 0 && paymentIndex < this.paymentSchedule.length) {
    const scheduledAmount = this.paymentSchedule[paymentIndex].dueAmount;
    if (amount !== scheduledAmount) {
      throw new Error(`Payment amount ${amount} does not match scheduled amount of ${scheduledAmount}`);
    }
    
    // Check if this payment would exceed total loan amount
    if (this.totalPaidAmount + amount > this.totalLoanAmount) {
      throw new Error(`Payment of ${amount} would exceed the total loan amount. Maximum payment allowed: ${this.totalLoanAmount - this.totalPaidAmount}`);
    }
    this.paymentSchedule[paymentIndex].status = 'paid';
    this.paymentSchedule[paymentIndex].bankReference = paymentDetails.bankReference;
    this.paymentSchedule[paymentIndex].paymentMethod = paymentDetails.paymentMethod;
    this.paymentSchedule[paymentIndex].description = paymentDetails.description;
    this.paymentSchedule[paymentIndex].paymentDate = new Date();
    
    this.totalPaidAmount += amount;
    
    // Check if all payments are made
    const allPaid = this.paymentSchedule.every(payment => payment.status === 'paid');
    if (allPaid) {
      this.isOpen = false;
    }
  }
};

// Method to update overdue status
debtSchema.methods.updateOverdueStatus = function() {
  const now = new Date();
  const fiveDaysBefore = new Date();
  
  this.paymentSchedule.forEach(payment => {
    if (payment.status !== 'paid') {
      fiveDaysBefore.setTime(payment.dueDate.getTime() - (5 * 24 * 60 * 60 * 1000));
      
      if (payment.dueDate < now) {
        payment.status = 'overdue';
      } else if (fiveDaysBefore <= now) {
        payment.status = 'upcoming';
      }
    }
  });
};

// Indexes for better query performance
debtSchema.index({ user: 1, isOpen: 1 });
debtSchema.index({ user: 1, bankName: 1 });
debtSchema.index({ user: 1, dueDate: 1 });
debtSchema.index({ 'paymentSchedule.dueDate': 1 });
debtSchema.index({ 'paymentSchedule.status': 1 });

// Ensure virtual fields are serialized
debtSchema.set('toJSON', { virtuals: true });
debtSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Debt', debtSchema);
