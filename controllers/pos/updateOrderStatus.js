const Order = require('../../models/Order');
const Cashier = require('../../models/Cashier');
const { setJSON, clearCache } = require('../../utils/redis');
const { formatDate } = require('../../utils/logging');

/**
 * @desc    Update order status
 * @route   PATCH /api/pos/orders/:orderId/status
 * @access  Private (Cashier only)
 */
exports.updateOrderStatus = async (req, res) => {
  const startTime = Date.now();
  const startTimeFormatted = formatDate(startTime);
  const { orderId } = req.params;
  const { status } = req.body;
  console.log(`\n[${startTimeFormatted}] - 🔄 UPDATE ORDER STATUS REQUEST | Order ID: ${orderId} | New Status: ${status} | User: ${req.user?.email} | IP: ${req.ip}`);

  try {
    // Check if user is a cashier
    if (req.user?.role !== process.env.CASHIER_KEY) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only cashiers can update order status.',
        statusCode: 403
      });
    }

    const { orderId } = req.params;
    const { status } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required',
        statusCode: 400
      });
    }

    // Require status to be provided
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required',
        statusCode: 400
      });
    }

    // Validate status
    const validStatuses = ['pending', 'received', 'preparing', 'shipped', 'delivered', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: ' + validStatuses.join(', '),
        statusCode: 400
      });
    }

    // Find and update order - support both _id and custom id
    const updateData = { status };
    let order;
    
    // Try to find by MongoDB _id first (if it looks like an ObjectId)
    if (orderId.match(/^[0-9a-fA-F]{24}$/)) {
      order = await Order.findOneAndUpdate(
        { _id: orderId },
        updateData,
        { new: true, runValidators: true }
      ).lean();
    }
    
    // If not found by _id, try by custom id field
    if (!order) {
      order = await Order.findOneAndUpdate(
        { id: orderId },
        updateData,
        { new: true, runValidators: true }
      ).lean();
    }

    if (!order) {
      // Log order not found attempt
      const cashier = await Cashier.findById(req.user.id);
      if (cashier) {
        await cashier.logOrderStatusUpdate(
          orderId, 
          updateData, 
          false, 
          'Order not found'
        );
      }

      return res.status(404).json({
        success: false,
        message: 'Order not found',
        statusCode: 404
      });
    }

    // Validate status progression order
    const statusOrder = ['pending', 'received', 'preparing', 'shipped', 'delivered'];
    const currentStatusIndex = statusOrder.indexOf(order.status);
    const newStatusIndex = statusOrder.indexOf(status);

    // Allow status update only if it's moving forward by exactly one step or cancelling
    if (status && currentStatusIndex !== -1 && newStatusIndex !== -1) {
      if (status === 'cancelled') {
        // Can cancel from any status except delivered
        if (order.status === 'delivered') {
          // Log invalid status progression
          const cashier = await Cashier.findById(req.user.id);
          if (cashier) {
            await cashier.logOrderStatusUpdate(
              orderId, 
              updateData, 
              false, 
              'Cannot cancel delivered order'
            );
          }

          return res.status(400).json({
            success: false,
            message: 'Cannot cancel a delivered order',
            statusCode: 400
          });
        }
      } else if (status === order.status) {
        // Allow updating to the same status (no change)
        // No validation needed for same status
      } else if (newStatusIndex !== currentStatusIndex + 1) {
        // Can only move forward by exactly one step
        // Log invalid status progression
        const cashier = await Cashier.findById(req.user.id);
        if (cashier) {
          await cashier.logOrderStatusUpdate(
            orderId, 
            updateData, 
            false, 
            `Invalid status progression: cannot change from ${order.status} to ${status}. Must follow sequential order.`
          );
        }

        return res.status(400).json({
          success: false,
          message: `Invalid status progression: cannot change from ${order.status} to ${status}. Must follow sequential order: pending → received → preparing → shipped → delivered`,
          statusCode: 400
        });
      }
    }

    // Invalidate the cache for this specific order
    const orderCacheKey = `order:${orderId}`;
    await clearCache(orderCacheKey);
    console.log(`[${startTimeFormatted}] - 🧹 Cache invalidated for order: ${orderId}`);

    // Invalidate all caches for order lists
    await clearCache('orders:*');
    console.log(`[${startTimeFormatted}] - 🧹 Cache invalidated for all order lists`);

    const responseTime = Date.now() - startTime;
    console.log(`[${startTimeFormatted}] - ✅ ORDER STATUS UPDATED SUCCESSFULLY | Total time: ${responseTime}ms`);

    res.status(200).json({
      success: true,
      message: 'Order updated successfully',
      data: order,
      statusCode: 200
    });

    // Log successful order status update
    const cashier = await Cashier.findById(req.user.id);
    if (cashier) {
      await cashier.logOrderStatusUpdate(orderId, updateData, true);
    }

  } catch (error) {
    console.error('Error updating order:', error);
    
    // Log failed order status update
    const cashier = await Cashier.findById(req.user.id);
    if (cashier) {
      await cashier.logOrderStatusUpdate(
        orderId || 'unknown', 
        { status }, 
        false, 
        error.message
      );
    }
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message),
        statusCode: 400
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      statusCode: 500
    });
  }
};
