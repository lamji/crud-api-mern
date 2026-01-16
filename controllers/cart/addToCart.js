const { validationResult } = require('express-validator');
const Cart = require('../../models/Cart');
const Product = require('../../models/Product');
const { cacheCart } = require('./getCart');

/**
 * @desc    Add item to cart
 * @route   POST /api/cart/add
 * @access  Private
 */
exports.addToCart = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
        statusCode: 400
      });
    }

    const { productId, quantity, price, size } = req.body;
    const userId = req.user.id;

    // Validate that quantity and price are positive numbers
    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be greater than 0',
        statusCode: 400
      });
    }

    if (price < 0) {
      return res.status(400).json({
        success: false,
        message: 'Price cannot be negative',
        statusCode: 400
      });
    }

    // Find or create cart atomically
    let cart = await Cart.findOne({ user: userId });
    
    if (!cart) {
      cart = await Cart.create({
        user: userId,
        items: [],
        totalAmount: 0
      });
    }

    // Check if product already exists in cart (with same size if size is provided)
    const existingItemIndex = cart.items.findIndex(
      item => item.product.toString() === productId && 
      (size ? item.size === size : !item.size)
    );

    if (existingItemIndex > -1) {
      // Update quantity if product exists
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      // Add new item
      cart.items.push({
        product: productId,
        quantity,
        price,
        size
      });
    }

    // Save and populate in one operation
    await cart.save();
    const populatedCart = await Cart.findById(cart._id)
      .populate('items.product', '-__v')
      .select('-__v -updatedAt -_id -user')
      .lean();

    // Update cache
    await cacheCart(`cart:${userId}`, populatedCart);

    // Find the newly added item (last item in the array)
    const newlyAddedItem = populatedCart.items[populatedCart.items.length - 1];
    
    // Calculate totals for the new item
    const itemTotal = newlyAddedItem.quantity * newlyAddedItem.price;
    
    // Create response with only the newly added item and its total
    const responseItem = {
      ...newlyAddedItem,
      itemTotal
    };

    res.status(201).json({
      success: true,
      message: 'Item added to cart successfully',
      data: responseItem,
      statusCode: 201
    });

  } catch (error) {
    console.error('Error adding item to cart:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message),
        statusCode: 400
      });
    }
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID format',
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
