# Debt Manager Schema Documentation

This document outlines the comprehensive schema for the debt management system, including all required data structures and relationships.

## Schema Overview

### 1. Debt Schema (`models/Debt.js`)

**Main Fields:**
- `bankName` - String, required, max 100 chars
- `totalLoanAmount` - Number, required, min 0
- `totalPaidAmount` - Number, default 0, min 0
- `isOpen` - Boolean, default true
- `loanStartDate` - Date, required
- `monthsToPay` - Number, required, min 1
- `monthlyAmortization` - Number, required, min 0
- `dueDate` - Date, required
- `firstPayment` - Number, required, 0-11 (represents months)
- `paymentSchedule` - Array of payment objects
- `user` - ObjectId reference to User

**Virtual Fields:**
- `totalPaidPercentage` - Calculated percentage of loan paid
- `isOverdue` - Boolean indicating if debt is overdue
- `remainingBalance` - Remaining amount to be paid

**Payment Schedule Array Structure:**
```javascript
{
  dueDate: Date,           // When payment is due
  dueAmount: Number,       // Amount due for this payment
  status: String           // "paid" | "overdue" | "upcoming"
}
```

**Key Features:**
- Automatically generates payment schedule based on `firstPayment` and `monthsToPay`
- Updates overdue status based on current date
- Tracks payment completion and closes debt when fully paid

### 2. Transaction Schema (`models/Transaction.js`)

**Main Fields:**
- `type` - String, enum: ["loan", "payment"], required
- `amount` - Number, required, min 0
- `description` - String, optional, max 500 chars
- `transactionDate` - Date, default now
- `details` - Object containing debt linkage
- `status` - String, enum: ["pending", "completed", "failed", "cancelled"]
- `user` - ObjectId reference to User

**Details Object Structure:**
```javascript
{
  debt: ObjectId,              // Reference to Debt document
  paymentScheduleIndex: Number, // Index in payment schedule (for payments)
  bankReference: String,       // Bank transaction reference
  paymentMethod: String        // "bank_transfer" | "cash" | "check" | "online" | "auto_debit"
}
```

**Virtual Fields:**
- `formattedAmount` - Currency formatted amount

**Key Features:**
- Automatically updates debt when payment transactions are completed
- Links transactions to specific payment schedule entries
- Provides summary and reporting methods

## Usage Examples

### Creating a New Debt
```javascript
const debt = new Debt({
  bankName: "Chase Bank",
  totalLoanAmount: 50000,
  monthsToPay: 24,
  monthlyAmortization: 2500,
  loanStartDate: new Date('2024-01-01'),
  dueDate: new Date('2026-01-01'),
  firstPayment: 2, // March (0-indexed)
  user: userId
});
```

### Creating a Payment Transaction
```javascript
const payment = new Transaction({
  type: 'payment',
  amount: 2500,
  details: {
    debt: debtId,
    paymentScheduleIndex: 0,
    bankReference: 'TXN123456',
    paymentMethod: 'bank_transfer'
  },
  user: userId
});
```

## Status Logic

### Payment Status Determination
- **"paid"** - Payment has been completed
- **"overdue"** - Due date has passed and payment not made
- **"upcoming"** - Payment is due within 5 days or in the future

### Debt Status
- **`isOpen: true`** - Debt has remaining payments
- **`isOpen: false`** - All payments completed
- **`isOverdue`** - Current due date has passed

## Database Indexes

**Debt Collection:**
- `{ user: 1, isOpen: 1 }`
- `{ user: 1, bankName: 1 }`
- `{ user: 1, dueDate: 1 }`
- `{ 'paymentSchedule.dueDate': 1 }`
- `{ 'paymentSchedule.status': 1 }`

**Transaction Collection:**
- `{ user: 1, type: 1 }`
- `{ user: 1, transactionDate: -1 }`
- `{ 'details.debt': 1, type: 1 }`
- `{ user: 1, status: 1 }`

## API Response Examples

See `examples/debtManagerExample.js` for complete examples of expected API responses and usage patterns.
