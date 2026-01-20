const { getJSON, setJSON } = require('../../utils/redis');
const { formatDate } = require('../../utils/logging');
const Cashier = require('../../models/Cashier');

/**
 * POS Logout - Cashier self logout
 * @route   POST /pos/logout
 * @access  Private (Cashier only)
 */
const posLogout = async (req, res) => {
  const startTime = Date.now();
  const startTimeFormatted = formatDate(startTime);
  let usedRedis = false;
  console.log(`\n[${startTimeFormatted}] - 🏪 POS LOGOUT PROCESS STARTED | Cashier: ${req.user?.userName} | IP: ${req.ip}`);

  try {
    // Check Redis cache first for cashier session
    const sessionKey = `cashier_session:${req.user?.userName}`;
    const cachedSession = await getJSON(sessionKey);
    
    if (cachedSession) {
      console.log(`[${startTimeFormatted}] - 🎯 Redis cache HIT for cashier session: ${req.user?.userName}`);
      usedRedis = true;
      
      // Clear cached session
      await setJSON(sessionKey, null, 1); // Expire immediately
      console.log(`[${startTimeFormatted}] - 💾 Cleared cashier session from Redis: ${req.user?.userName}`);
    } else {
      console.log(`[${startTimeFormatted}] - 🗄️ Redis cache MISS for cashier session: ${req.user?.userName}`);
      usedRedis = false;
    }
    
    // Clear the cookie if using cookies
    res.clearCookie('token');
    
    // Clear cashier active session in database
    const cashier = await Cashier.findById(req.user._id);
    
    if (cashier) {
      // Clear cashier active session
      await cashier.recordLogout(
        req.ip || req.connection.remoteAddress,
        req.get('User-Agent')
      );
      console.log(`[${startTimeFormatted}] - 🚪 Cashier logged out and session cleared: ${req.user?.userName}`);
    }
    
    const responseTime = Date.now() - startTime;
    console.log(`[${startTimeFormatted}] - ✅ POS LOGOUT SUCCESSFUL | Total time: ${responseTime}ms | Redis: ${usedRedis}`);
    
    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
      statusCode: 200
    });
  } catch (error) {
    console.error(`[${startTimeFormatted}] - 💥 POS LOGOUT ERROR: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
      statusCode: 500
    });
  }
};

/**
 * POS Force Logout - Admin force logout cashier
 * @route   POST /pos/force-logout
 * @access  Private (Admin only)
 */
const posForceLogout = async (req, res) => {
  const startTime = Date.now();
  const startTimeFormatted = formatDate(startTime);
  let usedRedis = false;
  const { userName } = req.body;
  
  console.log(`\n[${startTimeFormatted}] - 🔑 POS FORCE LOGOUT STARTED | Target: ${userName} | Admin: ${req.user?.email || req.user?.userName} | IP: ${req.ip}`);

  try {
    if (!userName) {
      return res.status(400).json({
        success: false,
        message: 'Username is required',
        statusCode: 400
      });
    }
    
    // Check Redis cache first for cashier session
    const sessionKey = `cashier_session:${userName.toLowerCase()}`;
    const cachedSession = await getJSON(sessionKey);
    
    if (cachedSession) {
      console.log(`[${startTimeFormatted}] - 🎯 Redis cache HIT for cashier session: ${userName}`);
      usedRedis = true;
      
      // Clear cached session immediately
      await setJSON(sessionKey, null, 1);
      console.log(`[${startTimeFormatted}] - 💾 Cleared cashier session from Redis: ${userName}`);
    } else {
      console.log(`[${startTimeFormatted}] - 🗄️ Redis cache MISS for cashier session: ${userName}`);
      usedRedis = false;
    }
    
    const cashier = await Cashier.findOne({ userName, isActive: true });
    
    if (!cashier) {
      return res.status(404).json({
        success: false,
        message: 'Cashier not found',
        statusCode: 404
      });
    }
    
    // Check if cashier has active session
    if (!cashier.hasActiveSession()) {
      return res.status(400).json({
        success: false,
        message: 'Cashier is not currently logged in',
        statusCode: 400
      });
    }
    
    // Force logout the cashier
    await cashier.recordLogout(
      req.ip || req.connection.remoteAddress,
      req.get('User-Agent')
    );
    
    console.log(`[${startTimeFormatted}] - 🚪 Force logout completed for cashier: ${userName}`);
    
    const responseTime = Date.now() - startTime;
    console.log(`[${startTimeFormatted}] - ✅ POS FORCE LOGOUT SUCCESSFUL | Total time: ${responseTime}ms | Redis: ${usedRedis}`);
    
    res.status(200).json({
      success: true,
      message: `Cashier ${userName} has been forcefully logged out`,
      statusCode: 200,
      data: {
        cashierName: cashier.name,
        userName: cashier.userName,
        previousSession: {
          ipAddress: cashier.sessionInfo?.ipAddress,
          loginTime: cashier.sessionInfo?.loginTime
        }
      }
    });
    
  } catch (error) {
    console.error(`[${startTimeFormatted}] - 💥 POS FORCE LOGOUT ERROR: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Force logout failed',
      statusCode: 500
    });
  }
};

module.exports = {
  posLogout,
  posForceLogout
};
