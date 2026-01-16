# PayMongo Integration

This directory contains the complete PayMongo payment gateway integration for your e-commerce system.

## Setup

### 1. Environment Variables

Add these to your `.env` file:

```env
# PayMongo Configuration
PAYMONGO_ENV=test  # Use 'live' for production
PAYMONGO_SECRET_KEY=sk_test_your_secret_key_here
PAYMONGO_PUBLIC_KEY=pk_test_your_public_key_here
PAYMONGO_WEBHOOK_SECRET_KEY=whsec_your_webhook_secret_here
```

### 2. PayMongo Dashboard Setup

1. Sign up at [PayMongo Dashboard](https://dashboard.paymongo.com/)
2. Get your API keys from Settings → API Keys
3. Set up webhooks at Settings → Webhooks
4. Configure webhook URL: `https://yourdomain.com/api/payments/webhook`

## API Endpoints

### Payment Flow

#### 1. Create Payment Intent
```http
POST /api/payments/intent
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "orderId": "ORD-2026-001",
  "amount": 150.50,
  "paymentMethodAllowed": ["card", "gcash", "maya"]
}
```

#### 2. Create Payment Method (Cards)
```http
POST /api/payments/method
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "type": "card",
  "details": {
    "card_number": "4123450141008230",
    "exp_month": 12,
    "exp_year": 2025,
    "cvc": "123"
  },
  "billing": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+639123456789"
  }
}
```

#### 3. Attach Payment Method
```http
POST /api/payments/attach
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "paymentIntentId": "pi_xxx",
  "paymentMethodId": "pm_xxx",
  "returnUrl": "https://yourapp.com/payment/success"
}
```

#### 4. Create Source (GCash/Maya)
```http
POST /api/payments/source
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "orderId": "ORD-2026-001",
  "type": "gcash",
  "amount": 150.50,
  "redirect": {
    "success": "https://yourapp.com/payment/success",
    "failed": "https://yourapp.com/payment/failed"
  }
}
```

#### 5. Get Payment Status
```http
GET /api/payments/pay_xxx
Authorization: Bearer <user_token>
```

#### 6. Process Refund (Admin Only)
```http
POST /api/payments/refund
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "paymentId": "pay_xxx",
  "amount": 150.50,
  "reason": "requested_by_customer"
}
```

### Webhook Endpoint

#### PayMongo Webhook
```http
POST /api/payments/webhook
Content-Type: application/json
PayMongo-Signature: <signature>
```

## Payment Methods Supported

### Credit/Debit Cards
- Visa, Mastercard
- 3D Secure support
- Card tokenization

### E-wallets
- GCash
- Maya
- GrabPay

## Order Status Flow

1. **Order Created** → `status: pending`, `paymentStatus: pending`
2. **Payment Initiated** → Payment intent/source created
3. **Payment Success** → `status: received`, `paymentStatus: paid`
4. **Payment Failed** → `status: pending`, `paymentStatus: failed`
5. **Payment Refunded** → `paymentStatus: refunded`

## Webhook Events Handled

- `payment.paid` - Payment successful
- `payment.failed` - Payment failed
- `payment.canceled` - Payment canceled
- `payment.refunded` - Payment refunded
- `payment_intent.payment_failed` - Payment intent failed
- `payment_intent.succeeded` - Payment intent succeeded
- `source.chargeable` - Source ready for charging

## Error Handling

All API responses follow consistent format:

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "statusCode": 400,
  "errors": [ ... ]
}
```

## Security Features

- Webhook signature verification
- Order ownership validation
- Admin-only refund processing
- Payment method validation
- Amount validation

## Testing

### Test Cards
Use PayMongo test cards for development:
- **Visa**: 4123450141008230
- **Mastercard**: 5123456789012346
- **3D Secure**: 4000002760003184

### Test E-wallets
Use PayMongo test credentials for GCash/Maya in test mode.

## Integration Examples

### Frontend Integration (JavaScript)

```javascript
// Create payment intent
const createPaymentIntent = async (orderId, amount) => {
  const response = await fetch('/api/payments/intent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ orderId, amount })
  });
  
  const result = await response.json();
  return result.data;
};

// Handle GCash payment
const handleGCashPayment = async (orderId, amount) => {
  const response = await fetch('/api/payments/source', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      orderId,
      type: 'gcash',
      amount,
      redirect: {
        success: `${window.location.origin}/payment/success`,
        failed: `${window.location.origin}/payment/failed`
      }
    })
  });
  
  const result = await response.json();
  window.location.href = result.data.redirectUrl;
};
```

## Monitoring

Monitor your PayMongo integration through:
- PayMongo Dashboard analytics
- Server logs for webhook events
- Order payment status tracking
- Error monitoring and alerts

## Support

- PayMongo Documentation: https://developers.paymongo.com/
- PayMongo Support: support@paymongo.com
- API Status: https://status.paymongo.com/
