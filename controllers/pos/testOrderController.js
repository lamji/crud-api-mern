const Order = require('../../models/Order');
const Product = require('../../models/Product');
const paymongoService = require('../../paymongo/index');
const { getJSON, setJSON } = require('../../utils/redis');
const { formatDate, logError } = require('../../utils/logging');

/**
 * @desc    Test Create Order with Payment Link
 * @route   POST /api/pos/test-create-order
 * @access  Public (for testing)
 */
exports.testCreateOrder = async (req, res) => {
  const startTime = new Date();
  console.log(`\n[${formatDate(startTime)}] - 🛒 TEST ORDER REQUEST RECEIVED | Endpoint: ${req.method} ${req.originalUrl} | Email: ${req.body.customer?.email || 'N/A'} | Items: ${req.body.items?.length || 0} | Payment: ${req.body.paymentMethod || 'N/A'} | User ID: ${req.user?.id || 'N/A'}`);
  
  try {

    const { customer, items, deliveryType, paymentMethod } = req.body;
    const userId = req.user?.id; // Get user ID from authenticated request

    // Validate required fields
    if (!customer || !items || !deliveryType || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: customer, items, deliveryType, paymentMethod',
        statusCode: 400
      });
    }

    // Validate customer data
    if (!customer.address || !customer.phonenumber) {
      return res.status(400).json({
        success: false,
        message: 'Customer address and phone number are required',
        statusCode: 400
      });
    }

    // Extract delivery fee from payload
    let deliveryFee = 0;
    if (deliveryType === 'delivery') {
      if (req.body.deliveryFee !== undefined) {
        deliveryFee = parseFloat(req.body.deliveryFee);
        if (isNaN(deliveryFee) || deliveryFee < 0) {
          return res.status(400).json({
            success: false,
            message: 'Invalid delivery fee amount',
            statusCode: 400
          });
        }
      } else {
        deliveryFee = 50.00; // Default delivery fee if not provided
        console.log(`[${formatDate()}] - 🚚 Using default delivery fee: ${deliveryFee}`);
      }
    }

    // Validate items
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item is required',
        statusCode: 400
      });
    }

    // Calculate total amount and delivery fee
    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      // Validate item structure
      if (!item.product || !item.quantity || !item.price) {
        return res.status(400).json({
          success: false,
          message: 'Each item must have product, quantity, and price',
          statusCode: 400
        });
      }

      // Verify product exists and get product details
      let productData = null;
      try {
        const product = await Product.findById(item.product);
        if (product) {
          productData = product;
          console.log(`[${formatDate()}] - ✅ Product found: ${product.title}`);
        } else {
          console.log(`[${formatDate()}] - ⚠️  Product not found: ${item.product} - continuing for testing`);
        }
      } catch (error) {
        console.log(`[${formatDate()}] - ⚠️  Error checking product: ${item.product} - continuing for testing`);
      }

      const itemTotal = item.quantity * item.price;
      totalAmount += itemTotal;

      orderItems.push({
        product: item.product,
        productName: productData ? productData.title : 'Product ' + item.product, // Use actual product title
        productImage: productData ? productData.imageSrc : '', // Use actual product image
        quantity: item.quantity,
        price: item.price,
        total: itemTotal
      });
    }

    // Add delivery fee if delivery type
    if (deliveryType === 'delivery') {
      totalAmount += deliveryFee;
      console.log(`[${formatDate()}] - 🚚 Delivery fee added: ${deliveryFee}`);
    }

    console.log(`[${formatDate()}] - 💰 Order Total: ${totalAmount} | Delivery Fee: ${deliveryFee} | Items Subtotal: ${totalAmount - deliveryFee}`);

    // Generate order ID
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    console.log(`[${formatDate()}] - 🆔 Generated Order ID: ${orderId}`);

    // Create order data (don't save yet)
    const orderData = {
      id: orderId,
      customer: {
        userid: userId, // Include user ID in customer.userid field
        name: customer.name || 'Test Customer',
        email: customer.email || 'test@example.com',
        phonenumber: customer.phonenumber,
        address: {
          line1: customer.address.line1 || 'Test Address',
          city: customer.address.city || 'Test City',
          state: customer.address.state || 'Test State',
          postal_code: customer.address.postal_code || '12345',
          country: customer.address.country || 'Test Country'
        }
      },
      items: orderItems,
      deliveryType: deliveryType,
      paymentMethod: paymentMethod,
      subtotal: totalAmount - deliveryFee,
      deliveryFee: deliveryFee,
      totalAmount: totalAmount,
      currency: 'PHP',
      status: 'pending',
      paymentStatus: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log(`[${formatDate()}] - 📋 Order data prepared: ${orderId} | User ID: ${userId}`);

    // Check if payment method is online - trigger payment link
    let paymentLink = null;
    let order = null; // Define order in main scope

    if (paymentMethod === 'online') {
      console.log(`[${formatDate()}] - 💳 Online payment detected - creating payment link...`);
      try {
        paymentLink = await paymongoService.createPaymentLink(
          totalAmount,
          `Payment for Order ${orderId}`,
          { oid: orderId }
        );
        console.log(`[${formatDate()}] - ✅ Payment link created: ${paymentLink.data.id}`);
        console.log(`[${formatDate()}] - 🔗 Checkout URL: ${paymentLink.data.attributes.checkout_url}`);

        orderData.status = 'processing';
        orderData.paymentStatus = 'pending';
        orderData.paymentLink = {
          id: paymentLink.data.id,
          checkoutUrl: paymentLink.data.attributes.checkout_url,
          reference: paymentLink.data.attributes.reference_number,
          status: paymentLink.data.attributes.status
        };
      } catch (paymentError) {
        logError(`❌ Payment link creation failed: ${paymentError.message}`);
        return res.status(400).json({
          success: false,
          message: 'Failed to create payment link',
          data: { orderData, paymentError: paymentError.message }
        });
      }
    } else {
      console.log(`[${formatDate()}] - 💵 Cash payment detected - creating order immediately`);
      orderData.status = 'confirmed';
      orderData.paymentStatus = 'pending_payment';
    }

    // Save the order to the database
    order = new Order(orderData);
    await order.save();
    console.log(`[${formatDate()}] - ✅ Order saved to database: ${order.id}`);

    // Cache the newly created order in Redis for 1 hour
    const orderCacheKey = `order:${order.id}`;
    await setJSON(orderCacheKey, order.toObject(), 3600);
    console.log(`[${formatDate()}] - 💾 Order cached in Redis for 1 hour: ${order.id}`);

    // Return success response
    const responseData = {
      success: true,
      message: paymentMethod === 'online' 
        ? 'Order created successfully - payment link generated'
        : 'Order created successfully - awaiting cash payment',
      data: {
        order: {
          id: orderData.id,
          customer: orderData.customer,
          items: orderData.items,
          deliveryType: orderData.deliveryType,
          paymentMethod: orderData.paymentMethod,
          subtotal: orderData.subtotal,
          deliveryFee: orderData.deliveryFee,
          totalAmount: orderData.totalAmount,
          status: orderData.status,
          paymentStatus: orderData.paymentStatus,
          createdAt: orderData.createdAt,
          updatedAt: orderData.updatedAt
        },
        paymentLink: paymentLink ? {
          id: paymentLink.data.id,
          checkoutUrl: paymentLink.data.attributes.checkout_url,
          reference: paymentLink.data.attributes.reference_number,
          amount: paymentLink.data.attributes.amount / 100,
          currency: paymentLink.data.attributes.currency,
          status: paymentLink.data.attributes.status,
          fee: (paymentLink.data.attributes.fee || 0) / 100,
          netAmount: (paymentLink.data.attributes.amount - (paymentLink.data.attributes.fee || 0)) / 100
        } : null
      }
    };

    console.log(`[${formatDate()}] - 📤 Sending order response | Order ID: ${orderId} | Total: ${totalAmount} | Payment: ${paymentMethod} | Processing Time: ${Date.now() - startTime.getTime()}ms`);

    res.status(201).json(responseData);

  } catch (error) {
    logError(`❌ TEST ORDER CREATION FAILED: ${error.message}`);
    logError(`📍 Stack Trace: ${error.stack}`);
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create test order',
      statusCode: 500,
      error: error.message
    });
  }
};

/**
 * @desc    Get Test Order Status
 * @route   GET /api/pos/test-order/:orderId
 * @access  Public (for testing)
 */
exports.getTestOrder = async (req, res) => {
  const startTime = new Date();
  let usedRedis = false;
  console.log(`\n[${formatDate(startTime)}] - 🔍 GET TEST ORDER REQUEST | Order ID: ${req.params.orderId} | Endpoint: ${req.method} ${req.originalUrl}`);
  
  try {
    const { orderId } = req.params;
    const orderCacheKey = `order:${orderId}`;

    // Check Redis cache first
    const cachedOrder = await getJSON(orderCacheKey);
    if (cachedOrder) {
      usedRedis = true;
      console.log(`[${formatDate()}] - 🎯 Redis cache HIT for order: ${orderId}`);
      console.log(`[${formatDate()}] - ✅ Order found (cached): ${cachedOrder.id} | Status: ${cachedOrder.status} | Payment: ${cachedOrder.paymentStatus}`);
      return res.status(200).json({
        success: true,
        message: 'Order retrieved successfully (from cache)',
        data: { order: cachedOrder }
      });
    }

    console.log(`[${formatDate()}] - 🗄️ Redis cache MISS for order: ${orderId}`);
    const order = await Order.findOne({ id: orderId }).lean(); // Use lean for performance

    if (!order) {
      logError(`❌ Order not found: ${orderId}`);
      return res.status(404).json({
        success: false,
        message: 'Order not found',
        statusCode: 404
      });
    }

    // Cache the order for 1 hour
    await setJSON(orderCacheKey, order, 3600);
    console.log(`[${formatDate()}] - 💾 Order cached in Redis for 1 hour: ${orderId}`);

    console.log(`[${formatDate()}] - ✅ Order found: ${order.id} | Status: ${order.status} | Payment: ${order.paymentStatus}`);

    res.status(200).json({
      success: true,
      message: 'Order retrieved successfully',
      data: { order }
    });

  } catch (error) {
    logError(`❌ GET TEST ORDER FAILED: ${error.message}`);
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get test order',
      statusCode: 500
    });
  }
};
