const BlacklistedToken = require('../../models/BlacklistedToken');
const { verifyToken } = require('../../utils/jwt');
const { getJSON, setJSON } = require('../../utils/redis');
const { formatDate } = require('../../utils/logging');

/**
 * Logout user by blacklisting the current token
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = async (req, res, next) => {
  const startTime = Date.now();
  const startTimeFormatted = formatDate(startTime);
  let usedRedis = false;
  console.log(`\n[${startTimeFormatted}] - 🚪 LOGOUT PROCESS STARTED | IP: ${req.ip}`);

  try {
    const token = req.headers.authorization.split(' ')[1];
    
    // Check Redis cache first for blacklisted token
    const blacklistKey = `blacklist:${token}`;
    const isBlacklisted = await getJSON(blacklistKey);
    
    if (isBlacklisted) {
      console.log(`[${startTimeFormatted}] - 🎯 Redis cache HIT - Token already blacklisted`);
      usedRedis = true;
      return res.status(200).json({
        success: true,
        message: 'Already logged out. Token was already invalidated.'
      });
    }
    
    // Decode token to get expiration time
    const decoded = verifyToken(token);
    
    // If token is already invalid/expired, verifyToken would have thrown an error
    // which is caught in the catch block
    
    // Create expiration date from token exp (in seconds)
    const expiresAt = new Date(decoded.exp * 1000);
    const ttl = Math.floor((expiresAt.getTime() - Date.now()) / 1000); // TTL in seconds

    // Cache token blacklist in Redis for faster lookups
    await setJSON(blacklistKey, { 
      token, 
      expiresAt: expiresAt.toISOString(),
      blacklistedAt: new Date().toISOString()
    }, ttl);
    console.log(`[${startTimeFormatted}] - 💾 Token blacklisted in Redis for ${ttl}s`);
    usedRedis = true;

    // Also save to database as backup
    await BlacklistedToken.create({
      token,
      expiresAt
    });

    const responseTime = Date.now() - startTime;
    console.log(`[${startTimeFormatted}] - ✅ LOGOUT SUCCESSFUL | Total time: ${responseTime}ms | Redis: ${usedRedis}`);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully. Token invalidated.'
    });
  } catch (error) {
    // If token verification fails, the user is already practically logged out
    const responseTime = Date.now() - startTime;
    console.log(`[${startTimeFormatted}] - ⚠️ LOGOUT WITH INVALID TOKEN | Total time: ${responseTime}ms | Redis: ${usedRedis}`);
    
    res.status(200).json({
      success: true,
      message: 'Logged out successfully.'
    });
  }
};

module.exports = {
  logout
};
