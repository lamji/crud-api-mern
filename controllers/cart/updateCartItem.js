const { validationResult } = require('express-validator');
const Cart = require('../../models/Cart');
const Product = require('../../models/Product');
const { cacheCart } = require('./getCart');

/**
 * @desc    Update cart item quantity
 * @route   PUT /api/cart/update/:itemId
 * @access  Private
 */
exports.updateCartItem = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
        statusCode: 400
      });
    }

    const { quantity } = req.body;
    const { itemId } = req.params;
    const userId = req.user.id;

    // Validate quantity
    if (quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity cannot be negative',
        statusCode: 400
      });
    }

    // Validate itemId format
    if (!itemId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid item ID format',
        statusCode: 400
      });
    }

    // Find cart and update item atomically
    const cart = await Cart.findOne({ user: userId });
    
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found',
        statusCode: 404
      });
    }

    const itemIndex = cart.items.findIndex(
      item => item._id.toString() === itemId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart',
        statusCode: 404
      });
    }

    if (quantity === 0) {
      // Remove item if quantity is 0
      cart.items.splice(itemIndex, 1);
    } else {
      // Update quantity
      cart.items[itemIndex].quantity = quantity;
    }

    // Save cart
    await cart.save();

    // Update cache
    await cacheCart(`cart:${userId}`, cart.toObject());

    res.status(200).json({
      success: true,
      message: 'Cart item updated successfully',
      statusCode: 200
    });

  } catch (error) {
    console.error('Error updating cart item:', error);
    
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
      requestId: req.id,
      statusCode: 500
    });
  }
};
