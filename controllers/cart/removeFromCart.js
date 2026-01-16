const Cart = require('../../models/Cart');
const Product = require('../../models/Product');
const RemovedItem = require('../../models/RemovedItem');
const { cacheCart } = require('./getCart');

/**
 * @desc    Remove item from cart
 * @route   DELETE /api/cart/remove/:itemId
 * @access  Private
 */
exports.removeFromCart = async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user.id;

    // Validate itemId format
    if (!itemId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid item ID format',
        statusCode: 400
      });
    }

    // Find cart and remove item atomically
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

    // Remove the item
    const removedItem = cart.items[itemIndex];
    cart.items.splice(itemIndex, 1);

    // Save cart
    await cart.save();

    // Store removed item in database
    await RemovedItem.create({
      user: userId,
      product: removedItem.product,
      quantity: removedItem.quantity,
      price: removedItem.price,
      size: removedItem.size,
      reason: 'user_removed'
    });

    // Update cache
    await cacheCart(`cart:${userId}`, cart.toObject());

    res.status(200).json({
      success: true,
      message: 'Item removed from cart successfully',
      statusCode: 200
    });

  } catch (error) {
    console.error('Error removing item from cart:', error);
    
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
