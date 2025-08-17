# Debt Manager API Documentation

A comprehensive REST API for managing debts and transactions with full CRUD operations, authentication, and analytics.

## Features
- Full CRUD operations for debts and transactions
- JWT-based authentication and protected routes
- Advanced filtering, pagination, and sorting
- Comprehensive analytics and reporting
- Payment scheduling and status tracking
- Data validation and error handling

## Tech Stack
- Express.js, MongoDB with Mongoose
- JWT Authentication
- Express Validator
- Error handling middleware
- CORS and security features

## Base URL
```
http://localhost:5000/api
```

## Authentication
All debt and transaction endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### Debt Endpoints

### List Debts
- Route: `GET /api/debts`
- Query Parameters:
  - `page` (number, default: 1)
  - `limit` (number, default: 10, max: 100)
  - `status` ("open" or "closed")
  - `bankName` (case-insensitive)
  - `sortBy` (createdAt, bankName, totalLoanAmount, dueDate)
  - `sortOrder` ("asc" or "desc", default: "desc")
- cURL:
```bash
curl "http://localhost:5000/api/debts?status=open&page=1&limit=10&sort=-createdAt" \
  -H "Authorization: Bearer <token>"
```

### Create Debt
- Route: `POST /api/debts`
- Body:
```json
{
  "bankName": "Chase Bank",
  "totalLoanAmount": 50000,
  "loanStartDate": "2024-01-01",
  "monthsToPay": 24,
  "monthlyAmortization": 2500,
  "dueDate": "2026-01-01",
  "firstPayment": 2
}
```
- cURL:
```bash
curl -X POST http://localhost:5000/api/debts \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"bankName":"Chase Bank","totalLoanAmount":50000}'
```

### Get Single Debt
- Route: `GET /api/debts/:id`
- cURL:
```bash
curl http://localhost:5000/api/debts/<debtId> \
  -H "Authorization: Bearer <token>"
```

### Update Debt
- Route: `PUT /api/debts/:id`
- Note: Restrictions apply if payments exist
- Body (any subset):
```json
{
  "bankName": "Updated Bank",
  "monthlyAmortization": 3000
}
```
- cURL:
```bash
curl -X PUT http://localhost:5000/api/debts/<debtId> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"monthlyAmortization":3000}'
```

### Delete Debt
- Route: `DELETE /api/debts/:id`
- Note: Deletes debt and all associated transactions
- cURL:
```bash
curl -X DELETE http://localhost:5000/api/debts/<debtId> \
  -H "Authorization: Bearer <token>"
```

### Close Debt
- Route: `POST /api/debts/:id/close`
- Description: Marks debt as closed while retaining all data and history
- Body:
```json
{
  "remarks": "Reason for closing the loan"
}
```
- cURL:
```bash
curl -X POST http://localhost:5000/api/debts/<debtId>/close \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"remarks":"Early loan closure due to refinancing"}'
```

### Make Payment
- Route: `POST /api/debts/:id/payment`
- Body:
```json
{
  "amount": 2500,
  "paymentScheduleIndex": 0,
  "bankReference": "TXN123456",
  "paymentMethod": "bank_transfer",
  "description": "Monthly payment"
}
```
- cURL:
```bash
curl -X POST http://localhost:5000/api/debts/<debtId>/payment \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"amount":2500,"paymentScheduleIndex":0}'
```

### Get Debt Summary
- Route: `GET /api/debts/:id/summary`
- Description: Get detailed analytics and payment history for a debt
- cURL:
```bash
curl http://localhost:5000/api/debts/<debtId>/summary \
  -H "Authorization: Bearer <token>"
```

### Response Example
```json
{
  "success": true,
  "data": {
    "debt": {...},
    "analytics": {
      "totalPayments": 24,
      "paidPayments": 5,
      "overduePayments": 2,
      "upcomingPayments": 17,
      "totalPaidAmount": 12500,
      "totalPaidPercentage": 25,
      "remainingBalance": 37500
    },
    "transactions": [
      {
        "_id": "transaction_id",
        "type": "payment",
        "amount": 2500,
        "description": "Monthly payment",
        "createdAt": "2025-08-01T12:00:00.000Z",
        "details": {
          "bankReference": "TXN123456",
          "paymentMethod": "bank_transfer"
        }
      }
    ]
  }
}
```

### Get Overdue Debts
- Route: `GET /api/debts/overdue`
- Description: Get all overdue debts for the authenticated user
- cURL:
```bash
curl http://localhost:5000/api/debts/overdue \
  -H "Authorization: Bearer <token>"
```

### Transaction Endpoints

### List Transactions
- Route: `GET /api/transactions`
- Query Parameters:
  - `page` (number, default: 1)
  - `limit` (number, default: 10)
  - `type` ("loan" or "payment")
  - `status` (string)
  - `debtId` (ObjectId)
  - `startDate` (YYYY-MM-DD)
  - `endDate` (YYYY-MM-DD)
  - `sortBy` (field name)
  - `sortOrder` ("asc" or "desc")
- cURL:
```bash
curl "http://localhost:5000/api/transactions?type=payment&page=1&limit=10" \
  -H "Authorization: Bearer <token>"
```

### Create Transaction
- Route: `POST /api/transactions`
- Body:
```json
{
  "type": "payment",
  "amount": 2500,
  "description": "Monthly payment",
  "details": {
    "debt": "debt_id_here",
    "paymentScheduleIndex": 0,
    "bankReference": "TXN123456",
    "paymentMethod": "bank_transfer"
  }
}
```
- cURL:
```bash
curl -X POST http://localhost:5000/api/transactions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"type":"payment","amount":2500}'
```

### Get Single Transaction
- Route: `GET /api/transactions/:id`
- cURL:
```bash
curl http://localhost:5000/api/transactions/<transactionId> \
  -H "Authorization: Bearer <token>"
```

### Update Transaction
- Route: `PUT /api/transactions/:id`
- Note: Restrictions apply for completed payments
- Body (any subset):
```json
{
  "description": "Updated payment description",
  "details": {
    "bankReference": "NEW-REF-123"
  }
}
```
- cURL:
```bash
curl -X PUT http://localhost:5000/api/transactions/<transactionId> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"description":"Updated payment description"}'
```

### Delete Transaction
- Route: `DELETE /api/transactions/:id`
- Note: Restrictions apply for completed payments
- cURL:
```bash
curl -X DELETE http://localhost:5000/api/transactions/<transactionId> \
  -H "Authorization: Bearer <token>"
```

### Get Debt Transactions Summary
- Route: `GET /api/transactions/debt/:debtId/summary`
- Description: Get transaction summary for a specific debt
- cURL:
```bash
curl http://localhost:5000/api/transactions/debt/<debtId>/summary \
  -H "Authorization: Bearer <token>"
```

### Get Monthly Summary
- Route: `GET /api/transactions/monthly/:year/:month`
- Description: Get monthly transaction summary with analytics
- Response:
```json
{
  "success": true,
  "data": {
    "year": 2024,
    "month": 3,
    "summary": {
      "totalPayments": 5,
      "totalAmount": 12500,
      "transactionCount": 6,
      "byPaymentMethod": {
        "bank_transfer": 10000,
        "online": 2500
      },
      "byBank": {
        "Chase Bank": 7500,
        "Wells Fargo": 5000
      }
    },
    "transactions": [...]
  }
}
```
- cURL:
```bash
curl http://localhost:5000/api/transactions/monthly/2024/3 \
  -H "Authorization: Bearer <token>"
```

### Get Analytics
- Route: `GET /api/transactions/analytics`
- Description: Get transaction analytics with date range filtering
- Query Parameters:
  - `startDate` (YYYY-MM-DD)
  - `endDate` (YYYY-MM-DD)
- cURL:
```bash
curl "http://localhost:5000/api/transactions/analytics?startDate=2024-01-01&endDate=2024-12-31" \
  -H "Authorization: Bearer <token>"
```

## Models

### Debt Model
```json
{
  "_id": "ObjectId",
  "bankName": "String (required, max 100 chars)",
  "totalLoanAmount": "Number (required, min 0)",
  "totalPaidAmount": "Number (default 0)",
  "isOpen": "Boolean (default true)",
  "totalPaidPercentage": "Number (virtual)",
  "loanStartDate": "Date (required)",
  "monthsToPay": "Number (required, min 1)",
  "monthlyAmortization": "Number (required, min 0)",
  "dueDate": "Date (required)",
  "isOverdue": "Boolean (virtual)",
  "firstPayment": "Number (required, 0-11)",
  "remainingBalance": "Number (virtual)",
  "paymentSchedule": [{
    "dueDate": "Date",
    "dueAmount": "Number",
    "status": "String (paid|overdue|upcoming)"
  }],
  "user": "ObjectId (ref: User)",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### Transaction Model
```json
{
  "_id": "ObjectId",
  "type": "String (loan|payment)",
  "amount": "Number (required, min 0)",
  "formattedAmount": "String (virtual)",
  "description": "String (max 500)",
  "transactionDate": "Date (default: now)",
  "details": {
    "debt": "ObjectId (ref: Debt)",
    "paymentScheduleIndex": "Number",
    "bankReference": "String",
    "paymentMethod": "String (bank_transfer|cash|check|online|auto_debit)"
  },
  "status": "String (pending|completed|failed|cancelled)",
  "user": "ObjectId (ref: User)",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

## Business Logic

### Payment Status Rules
- **Paid**: Payment completed successfully
- **Overdue**: Due date passed without payment
- **Upcoming**: Payment due within 5 days or in future

### Payment Schedule
- Generated from `firstPayment` (0-11) and `monthsToPay`
- First payment month: 0=January through 11=December
- Subsequent payments scheduled monthly

## Error Handling

### Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "errors": [/* Validation errors if any */]
}
```

### HTTP Status Codes
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `500`: Server Error

## Quick Start Example

### Create and Manage a Debt

1. Create debt:
```bash
curl -X POST http://localhost:5000/api/debts \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "bankName": "Chase Bank",
    "totalLoanAmount": 50000,
    "loanStartDate": "2024-01-01",
    "monthsToPay": 24,
    "monthlyAmortization": 2500,
    "dueDate": "2026-01-01",
    "firstPayment": 2
  }'
```

2. Make payment:
```bash
curl -X POST http://localhost:5000/api/debts/<debtId>/payment \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 2500,
    "paymentScheduleIndex": 0,
    "bankReference": "TXN123456"
  }'
```

3. Check summary:
```bash
curl http://localhost:5000/api/debts/<debtId>/summary \
  -H "Authorization: Bearer <token>"
```

## Key Features

- JWT Authentication
- Input Validation
- Error Handling
- Pagination & Filtering
- Analytics & Reporting
- Data Integrity
- Status Management
