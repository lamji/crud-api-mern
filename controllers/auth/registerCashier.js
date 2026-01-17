const Cashier = require('../../models/Cashier');
const { generateToken } = require('../../utils/jwt');
const { getJSON, setJSON } = require('../../utils/redis');
const { formatDate } = require('../../utils/logging');

/**
 * @desc    Register new cashier (direct registration, no OTP required)
 * @route   POST /api/auth/register/cashier
 * @access  Public
 */
exports.registerCashier = async (req, res) => {
  const startTime = Date.now();
  const startTimeFormatted = formatDate(startTime);
  let usedRedis = false;
  console.log(`\n[${startTimeFormatted}] - 🏦 CASHIER REGISTRATION STARTED | IP: ${req.ip}`);

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

    // Check Redis cache first for existing cashier
    const cashierCacheKey = `cashier_exists:${userName.toLowerCase()}`;
    const cachedCashierExists = await getJSON(cashierCacheKey);
    
    if (cachedCashierExists !== null) {
      console.log(`[${startTimeFormatted}] - 🎯 Redis cache HIT for cashier check: ${userName}`);
      usedRedis = true;
      if (cachedCashierExists) {
        console.log(`[${startTimeFormatted}] - ❌ Cashier already exists (cached): ${userName}`);
        return res.status(400).json({
          success: false,
          message: 'Cashier already exists with this username or name'
        });
      }
    } else {
      console.log(`[${startTimeFormatted}] - 🗄️ Redis cache MISS for cashier check: ${userName}`);
      usedRedis = false;
    }

    // Check if cashier already exists in database
    const existingCashier = await Cashier.findOne({
      $or: [{ userName }, { name }]
    }).lean();

    if (existingCashier) {
      // Cache the result for 5 minutes
      await setJSON(cashierCacheKey, true, 300);
      console.log(`[${startTimeFormatted}] - 💾 Cached cashier exists result: ${userName}`);
      return res.status(400).json({
        success: false,
        message: 'Cashier already exists with this username or name'
      });
    }

    // Cache that cashier doesn't exist for 1 minute
    await setJSON(cashierCacheKey, false, 60);
    console.log(`[${startTimeFormatted}] - 💾 Cached cashier not exists result: ${userName}`);

    // Create cashier
    const cashier = await Cashier.create({
      name,
      userName,
      password,
      isActive: true
    });

    // Cache new cashier data for 5 minutes
    const newCashierKey = `cashier:${userName.toLowerCase()}`;
    const cashierData = {
      id: cashier._id,
      name: cashier.name,
      userName: cashier.userName,
      role: process.env.CASHIER_ROLE || 'cashier',
      isActive: cashier.isActive,
      createdAt: cashier.createdAt
    };
    await setJSON(newCashierKey, cashierData, 300);
    console.log(`[${startTimeFormatted}] - 💾 New cashier cached in Redis: ${userName}`);

    const responseTime = Date.now() - startTime;
    console.log(`[${startTimeFormatted}] - ✅ CASHIER REGISTRATION SUCCESSFUL | Total time: ${responseTime}ms | Redis: ${usedRedis}`);

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Cashier registered successfully',
      data: cashierData
    });

  } catch (error) {
    console.error(`[${startTimeFormatted}] - 💥 CASHIER REGISTRATION ERROR: ${error.message}`);
    
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
