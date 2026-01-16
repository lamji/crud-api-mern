const { createOrder } = require('./createOrder');
const { getOrders } = require('./getOrders');
const { getOrderById } = require('./getOrderById');
const { updateOrderStatus } = require('./updateOrderStatus');

// Re-export all POS functions for use in routes
module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus
};
