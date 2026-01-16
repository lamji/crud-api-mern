const axios = require('axios');

class PayMongoService {
  constructor() {
    this.baseURL = process.env.PAYMONGO_ENV === 'live' 
      ? 'https://api.paymongo.com/v1' 
      : 'https://api.paymongo.com/v1';
    this.secretKey = process.env.PAYMONGO_SECRET_KEY;
    this.publicKey = process.env.PAYMONGO_PUBLIC_KEY;
    
    if (!this.secretKey) {
      console.warn('PayMongo secret key not found in environment variables');
    }
  }

  // Get authorization headers
  getAuthHeaders() {
    return {
      'Authorization': `Basic ${Buffer.from(this.secretKey + ':').toString('base64')}`,
      'Content-Type': 'application/json'
    };
  }

  // Create Payment Intent
  async createPaymentIntent(amount, currency = 'PHP', paymentMethodAllowed = ['card', 'gcash', 'paymaya'], metadata = {}) {
    try {
      const response = await axios.post(`${this.baseURL}/payment_intents`, {
        data: {
          attributes: {
            amount: amount * 100, // Convert to cents
            currency: currency,
            payment_method_allowed: paymentMethodAllowed,
            payment_method_options: {
              card: {
                request_three_d_secure: 'any'
              },
              gcash: {
                request_three_d_secure: 'any'
              },
              paymaya: {
                request_three_d_secure: 'any'
              }
            },
            statement_descriptor: 'E-COMMERCE ORDER',
            metadata: {
              ...metadata,
              source: 'ecommerce_api'
            }
          }
        }
      }, {
        headers: this.getAuthHeaders()
      });

      return response.data;
    } catch (error) {
      console.error('PayMongo createPaymentIntent error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.detail || 'Failed to create payment intent');
    }
  }

  // Create Payment Method
  async createPaymentMethod(type, details, billing = {}) {
    try {
      // Convert camelCase to snake_case for PayMongo API
      const payMongoDetails = {};
      const payMongoBilling = {};

      // Map card details
      if (details.cardNumber) payMongoDetails.card_number = details.cardNumber;
      if (details.expMonth) payMongoDetails.exp_month = details.expMonth;
      if (details.expYear) payMongoDetails.exp_year = details.expYear;
      if (details.cvc) payMongoDetails.cvc = details.cvc;

      // Map billing details
      if (billing.name) payMongoBilling.name = billing.name;
      if (billing.email) payMongoBilling.email = billing.email;
      if (billing.phone) payMongoBilling.phone = billing.phone;
      if (billing.address) payMongoBilling.address = billing.address;

      const paymentMethodData = {
        data: {
          attributes: {
            type: type,
            details: payMongoDetails,
            billing: payMongoBilling
          }
        }
      };

      const response = await axios.post(`${this.baseURL}/payment_methods`, paymentMethodData, {
        headers: this.getAuthHeaders()
      });

      return response.data;
    } catch (error) {
      console.error('PayMongo createPaymentMethod error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.detail || 'Failed to create payment method');
    }
  }

  // Attach Payment Method to Payment Intent
  async attachPaymentMethod(paymentIntentId, paymentMethodId, returnUrl = null, clientKey = null) {
    try {
      const attributes = {
        payment_method: paymentMethodId
      };

      // Add return_url if provided
      if (returnUrl) {
        attributes.return_url = returnUrl;
      }

      // Add client_key if provided (for public API key usage)
      if (clientKey) {
        attributes.client_key = clientKey;
      }

      const response = await axios.post(`${this.baseURL}/payment_intents/${paymentIntentId}/attach`, {
        data: {
          attributes: attributes
        }
      }, {
        headers: this.getAuthHeaders()
      });

      return response.data;
    } catch (error) {
      console.error('PayMongo attachPaymentMethod error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.detail || 'Failed to attach payment method');
    }
  }

  // Get Payment Intent
  async getPaymentIntent(paymentIntentId) {
    try {
      const response = await axios.get(`${this.baseURL}/payment_intents/${paymentIntentId}`, {
        headers: this.getAuthHeaders()
      });

      return response.data;
    } catch (error) {
      console.error('PayMongo getPaymentIntent error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.detail || 'Failed to get payment intent');
    }
  }

  // Create Source for GCash/Maya
  async createSource(type, amount, currency = 'PHP', redirect = {}, metadata = {}) {
    try {
      const response = await axios.post(`${this.baseURL}/sources`, {
        data: {
          attributes: {
            type: type,
            amount: amount * 100, // Convert to cents
            currency: currency,
            redirect: redirect,
            metadata: {
              ...metadata,
              source: 'ecommerce_api'
            }
          }
        }
      }, {
        headers: this.getAuthHeaders()
      });

      return response.data;
    } catch (error) {
      console.error('PayMongo createSource error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.detail || 'Failed to create source');
    }
  }

  // Verify webhook signature
  verifyWebhookSignature(payload, signature) {
    try {
      // If no signature verification is set up, return true for testing
      if (!process.env.PAYMONGO_WEBHOOK_SECRET_KEY) {
        console.warn('⚠️  Webhook signature verification disabled - No PAYMONGO_WEBHOOK_SECRET_KEY found');
        return true;
      }

      const crypto = require('crypto');
      
      // Parse the signature header
      const signatureParts = signature.split(',');
      let timestamp = '';
      let testSignature = '';
      let liveSignature = '';

      signatureParts.forEach(part => {
        const [key, value] = part.split('=');
        if (key === 't') timestamp = value;
        else if (key === 'te') testSignature = value;
        else if (key === 'li') liveSignature = value;
      });

      // Choose the appropriate signature based on environment
      const receivedSignature = process.env.PAYMONGO_ENV === 'live' ? liveSignature : testSignature;
      
      if (!receivedSignature) {
        console.error('❌ No valid signature found in header');
        return false;
      }

      // Create the signed payload string
      const signedPayload = `${timestamp}.${payload}`;
      
      // Create HMAC SHA256 hash
      const expectedSignature = crypto
        .createHmac('sha256', process.env.PAYMONGO_WEBHOOK_SECRET_KEY)
        .update(signedPayload, 'utf8')
        .digest('hex');

      // Compare signatures
      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(receivedSignature, 'hex')
      );

      if (!isValid) {
        console.error('❌ Signature verification failed');
        console.log('🔍 Expected:', expectedSignature);
        console.log('🔍 Received:', receivedSignature);
        console.log('🔍 Payload:', payload);
      }

      return isValid;
    } catch (error) {
      console.error('❌ Webhook signature verification error:', error);
      return false;
    }
  }

  // Get Payment by ID
  async getPayment(paymentId) {
    try {
      const response = await axios.get(`${this.baseURL}/payments/${paymentId}`, {
        headers: this.getAuthHeaders()
      });

      return response.data;
    } catch (error) {
      console.error('PayMongo getPayment error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.detail || 'Failed to get payment');
    }
  }

  // Create Payment Link
  async createPaymentLink(amount, description = 'Payment', metadata = {}) {
    try {
      const response = await axios.post(`${this.baseURL}/links`, {
        data: {
          attributes: {
            amount: amount * 100, // Convert to cents
            currency: 'PHP',
            description: description,
            remarks: 'Payment via E-Commerce API',
            payment_method_allowed: ['card', 'gcash', 'paymaya', 'grab_pay', 'qrph', 'dob', 'billease', 'shopee_pay'],
            metadata: {
              ...metadata,
              source: 'ecommerce_api'
            }
          }
        }
      }, {
        headers: this.getAuthHeaders()
      });

      return response.data;
    } catch (error) {
      console.error('PayMongo createPaymentLink error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.detail || 'Failed to create payment link');
    }
  }

  // Get Payment Link by ID
  async getPaymentLink(linkId) {
    try {
      const response = await axios.get(`${this.baseURL}/links/${linkId}`, {
        headers: this.getAuthHeaders()
      });

      return response.data;
    } catch (error) {
      console.error('PayMongo getPaymentLink error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.detail || 'Failed to get payment link');
    }
  }

  // Refund Payment
  async refundPayment(paymentId, amount = null, reason = 'requested_by_customer') {
    try {
      const refundData = {
        data: {
          attributes: {
            payment_id: paymentId,
            reason: reason
          }
        }
      };

      if (amount) {
        refundData.data.attributes.amount = amount * 100; // Convert to cents
      }

      const response = await axios.post(`${this.baseURL}/refunds`, refundData, {
        headers: this.getAuthHeaders()
      });

      return response.data;
    } catch (error) {
      console.error('PayMongo refundPayment error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.detail || 'Failed to refund payment');
    }
  }

  // Create Payment from Source
  async createPaymentFromSource(sourceId, amount = null) {
    try {
      const paymentData = {
        data: {
          attributes: {
            source: {
              id: sourceId,
              type: 'source'
            }
          }
        }
      };

      // Add amount if provided
      if (amount) {
        paymentData.data.attributes.amount = amount * 100;
      }

      const response = await axios.post(`${this.baseURL}/payments`, paymentData, {
        headers: this.getAuthHeaders()
      });

      return response.data;
    } catch (error) {
      console.error('PayMongo createPaymentFromSource error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.errors?.[0]?.detail || 'Failed to create payment from source');
    }
  }
}

module.exports = new PayMongoService();