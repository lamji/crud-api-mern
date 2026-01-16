const { getCart } = require('./getCart');
const { addToCart } = require('./addToCart');
const { updateCartItem } = require('./updateCartItem');
const { removeFromCart } = require('./removeFromCart');

// Re-export all cart functions for use in routes
module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart
};
