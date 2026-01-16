const Order = require('../../models/Order');
const Profile = require('../../models/Profile');
const User = require('../../models/User');
const { createPaymentNotification } = require('./createPaymentNotification');
const { logError, formatDate } = require('../../utils/logging');

async function updateOrderStatus(orderId, status, paymentId, paymentData = {}) {
  try {
    console.log(`\n[${formatDate()}] - 🔍 UPDATING ORDER IN DATABASE`);
    console.log(`[${formatDate()}] - 📋 Update Parameters | Order ID: ${orderId} | Status: ${status} | Payment ID: ${paymentId}`);
    
    const order = await Order.findOne({ id: orderId });
    if (order) {
      console.log(`[${formatDate()}] - ✅ Order found in database, current status: ${order.status}`);
      // Update basic status
      order.status = status;
      order.paymentStatus = status;
      order.paymentId = paymentId;
      
      // Update payment details if provided
      if (paymentData.paymentMethod) {
        order.paymentMethod = paymentData.paymentMethod;
      }
      if (paymentData.paymentLinkId) {
        // Remove checkoutUrl after payment is completed
        const { checkoutUrl, ...existingPaymentLink } = order.paymentLink || {};
        
        order.paymentLink = {
          ...existingPaymentLink,
          id: paymentData.paymentLinkId,
          paid: true,
          status: 'paid' // Update status to paid as well
        };
        
        console.log(`[${formatDate()}] - 🗑️ Removed checkoutUrl from paymentLink after payment completion`);
      }
      if (paymentData.paymentReference) {
        order.paymentReference = paymentData.paymentReference;
      }
      if (paymentData.paymentAmount) {
        order.paymentAmount = paymentData.paymentAmount;
      }
      if (paymentData.paymentFee !== undefined) {
        order.paymentFee = paymentData.paymentFee;
      }
      if (paymentData.paymentNetAmount) {
        order.paymentNetAmount = paymentData.paymentNetAmount;
      }
      if (paymentData.paymentCurrency) {
        order.paymentCurrency = paymentData.paymentCurrency;
      }
      if (paymentData.paidAt) {
        order.paidAt = paymentData.paidAt;
      }
      
      await order.save();
      
      // Associate order with user profile if user ID exists
      if (order.customer?.userid && status === 'paid') {
        try {
          // Find the user by ID (more reliable than email)
          const user = await User.findById(order.customer.userid);
          
          if (user) {
            console.log(`[${formatDate()}] - 👤 Found user by ID: ${user.email} (${order.customer.userid})`);
            
            // Find the profile associated with this user
            let profile = await Profile.findOne({ userId: user._id });
            
            if (!profile) {
              console.log(`[${formatDate()}] - ⚠️  No profile found for user ${user.email}, skipping order association`);
              return;
            }
            
            // Check if order is already in profile's orders array
            const existingOrderIndex = profile.orders.findIndex(
              profileOrder => profileOrder.orderNumber === orderId
            );
            
            if (existingOrderIndex === -1) {
              // Determine payment type from order details
              let paymentType = 'gcash'; // default for PayMongo 
              if (order.paymentMethod && order.paymentMethod.type) {
                const sourceType = order.paymentMethod.type;
                console.log(`[${formatDate()}] - 🔍 DEBUG: Source type from order = ${sourceType}`);
                
                // Use the actual payment type from PayMongo without conversion
                // Valid enum values: ['qrph', 'brankas', 'card', 'dob', 'billease', 'gcash', 'grab_pay', 'shopee_pay', 'paymaya', 'credit_card', 'debit_card', 'paypal', 'apple_pay', 'google_pay', 'online', 'cash']
                paymentType = sourceType;
                console.log(`[${formatDate()}] - 🔍 DEBUG: Using payment type = ${paymentType}`);
              }
              
              // Add new order to profile orders array
              profile.orders.push({
                orderId: order._id, // Include MongoDB order _id for easy population
                orderNumber: orderId,
                date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
                orderDate: order.createdAt,
                status: order.status === 'paid' ? 'processing' : order.status,
                totalAmount: order.totalAmount,
                shippingFee: order.shippingFee || 0,
                paymentFee: order.paymentFee || 0,
                items: order.items.map(item => ({
                  productId: item.product,
                  productName: item.productName || 'Product ' + item.product, // Will be updated when populated
                  productImage: item.productImage || '', // Will be updated when populated
                  productPrice: item.price,
                  quantity: item.quantity,
                  price: item.price
                })),
                shippingAddress: {
                  street: order.customer.address?.line1 || '',
                  city: order.customer.address?.city || '',
                  state: order.customer.address?.state || '',
                  zipCode: order.customer.address?.postal_code || '',
                  country: order.customer.address?.country || ''
                },
                paymentMethod: {
                  // Include full payment method details from PayMongo
                  type: paymentType, // Use actual payment type
                  source: order.paymentMethod?.source || null,
                  billing: order.paymentMethod?.billing || null,
                  transaction: order.paymentMethod?.transaction || null,
                  amounts: order.paymentMethod?.amounts || null,
                  timestamps: order.paymentMethod?.timestamps || null,
                  status: order.paymentMethod?.status || null,
                  origin: order.paymentMethod?.origin || null,
                  // Legacy fields for backward compatibility
                  paidAt: order.paymentMethod?.timestamps?.paidAt || new Date(),
                  transactionId: order.paymentId || order.paymentLink?.id || order.paymentMethod?.transaction?.id
                }
              });
              
              await profile.save();
              console.log(`[${formatDate()}] - ✅ Order ${orderId} added to user ${user.email} profile`);
              console.log(`[${formatDate()}] - 👤 Profile now has ${profile.orders.length} orders`);
              
              // Send payment confirmation email
              await createPaymentNotification(
                order.customer.userid,
                'Payment Confirmed',
                `Your payment for order ${orderId} has been successfully processed.`,
                'payment_confirmed'
              );
              
              // Update profile stats
              profile.stats.totalOrders = profile.orders.length;
              profile.stats.totalSpent += order.totalAmount || 0;
              profile.stats.averageOrderValue = profile.stats.totalSpent / profile.stats.totalOrders;
              await profile.save();
              console.log(`[${formatDate()}] - 📊 Updated profile stats - Total Orders: ${profile.stats.totalOrders}, Total Spent: ${profile.stats.totalSpent}`);
              
            } else {
              console.log(`[${formatDate()}] - ℹ️  Order ${orderId} already exists in user ${user.email}'s profile`);
            }
          } else {
            logError(`❌ No user found with ID: ${order.customer.userid}`);
          }
        } catch (profileError) {
          logError(`❌ Error associating order with user profile: ${profileError.message}`);
        }
      } else if (!order.customer?.userid && status === 'paid') {
        console.log(`[${formatDate()}] - ⚠️  Order ${orderId} has no user ID, skipping profile association`);
      }
      
      console.log(`\n[${formatDate()}] - 🎉 ORDER ${orderId} UPDATED SUCCESSFULLY IN DATABASE`);
      console.log(`[${formatDate()}] - 📊 Complete Order Data After Update | Status: ${order.status} | Payment: ${order.paymentStatus} | Total: ₱${order.totalAmount} | Payment ID: ${order.paymentId}`);
      console.log(`[${formatDate()}] - 🔚 END ORDER DATA LOG\n`);
    } else {
      logError(`❌ Order not found: ${orderId}`);
    }
  } catch (error) {
    logError(`❌ Error updating order status: ${error.message}`);
  }
}

module.exports = { updateOrderStatus };
