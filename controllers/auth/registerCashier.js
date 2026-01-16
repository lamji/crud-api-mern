const Cashier = require('../../models/Cashier');
const { generateToken } = require('../../utils/jwt');

/**
 * @desc    Register new cashier (direct registration, no OTP required)
 * @route   POST /api/auth/register/cashier
 * @access  Public
 */
exports.registerCashier = async (req, res) => {
  try {
    const { name, userName, password, role } = req.body;

    // Validate role key against environment variable
    const CASHIER_KEY = process.env.CASHIER_KEY;
    if (!CASHIER_KEY) {
      return res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
    }

    if (role !== CASHIER_KEY) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role key'
      });
    }

    // Check if cashier already exists
    const existingCashier = await Cashier.findOne({
      $or: [{ userName }, { name }]
    });

    if (existingCashier) {
      return res.status(400).json({
        success: false,
        message: 'Cashier already exists with this username or name'
      });
    }

    // Create cashier
    const cashier = await Cashier.create({
      name,
      userName,
      password,
      isActive: true
    });

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Cashier registered successfully',
      data: {
        id: cashier._id,
        name: cashier.name,
        userName: cashier.userName,
        role: process.env.CASHIER_ROLE || 'cashier',
        isActive: cashier.isActive,
        createdAt: cashier.createdAt
      }
    });

  } catch (error) {
    console.error('Cashier registration error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Cashier already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
