const { validationResult } = require('express-validator');
const User = require('../../models/User');
const Cashier = require('../../models/Cashier');
const { generateToken } = require('../../utils/jwt');
const { formatDate, logError } = require('../../utils/logging');
const { getJSON, setJSON } = require('../../utils/redis');

/**
 * Handle user login
 * - Validates request
 * - Verifies credentials with User.findByCredentials
 * - Updates lastLogin atomically for concurrency safety
 * - Returns JWT and user info
 * - Optimized for high-volume requests
 */
async function login(req, res, next) {
  const startTime = Date.now();
  const startTimeFormatted = formatDate(startTime);
  const { email, password } = req.body;
  let usedRedis = false; // Track if Redis was used
  const debugLog = (...args) => {
    if (process.env.DEBUG_AUTH === 'true') {
      console.log(...args);
    }
  };
  debugLog(`\n[${startTimeFormatted}] - 🔐 LOGIN PROCESS STARTED | Email: ${email} | IP: ${req.ip}`);

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      debugLog(`[${startTimeFormatted}] - ❌ Validation failed | Email: "${email}" | Password: "${password ? '[REDACTED]' : 'EMPTY'}" | Errors:`, errors.array());
      logError('❌ Validation failed');
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    debugLog(`[${startTimeFormatted}] - 🔍 Login check for: ${email}`);

    // Check Redis cache first for user data
    const userCacheKey = `user:${email.toLowerCase()}`;
    const cachedUser = await getJSON(userCacheKey);
    
    if (cachedUser) {
      debugLog(`[${startTimeFormatted}] - 🎯 Redis cache HIT for user: ${email}`);
      usedRedis = true;
      // Verify cached user password
      try {
        const tempUser = new User(cachedUser);
        const isMatch = await tempUser.matchPassword(password);
        
        if (isMatch) {
          debugLog(`[${startTimeFormatted}] - ✅ Cached user credentials verified: ${cachedUser.name}`);
          
          const token = generateToken({ id: cachedUser._id, role: cachedUser.role });
          const userData = {
            name: cachedUser.name,
            email: cachedUser.email,
            role: cachedUser.role,
            lastLogin: new Date(),
            createdAt: cachedUser.createdAt,
            signupPlatform: cachedUser.signupPlatform || 'web',
          };
          
          const responseTime = Date.now() - startTime;
          debugLog(`[${startTimeFormatted}] - ✅ CACHED USER LOGIN SUCCESSFUL | Total time: ${responseTime}ms | Redis: ${usedRedis}`);
          return res.status(200).json({ success: true, message: 'Login successful', token, user: userData });
        }
      } catch (passwordError) {
        debugLog(`[${startTimeFormatted}] - ⚠️ Cached user password verification failed, falling back to DB`);
        usedRedis = false;
      }
    } else {
      debugLog(`[${startTimeFormatted}] - 🗄️ Redis cache MISS for user: ${email}`);
      usedRedis = false;
    }

    let user;
    let cashier;
    let userAuthError;

    try {
      user = await User.findByCredentials(email, password);
    } catch (err) {
      userAuthError = err;
    }

    // --- User Login Success ---
    if (user) {
      debugLog(`[${startTimeFormatted}] - ✅ User credentials verified: ${user.name}`);

      // Non-blocking lastLogin update to avoid adding write latency on hot path
      User.updateOne(
        { _id: user._id },
        { $set: { lastLogin: new Date() } }
      ).catch(() => {});

      // Cache only minimal data (including password hash for verification) in Redis for 5 minutes (300 seconds)
      const userToCache = {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        password: user.password,
        createdAt: user.createdAt,
        signupPlatform: user.signupPlatform || 'web',
        createdAtKey: user.createdAtKey,
      };
      await setJSON(userCacheKey, userToCache, 300);
      debugLog(`[${startTimeFormatted}] - 💾 User data cached in Redis for 5 minutes`);

      const userData = {
        name: user.name,
        email: user.email,
        role: user.role,
        lastLogin: new Date(),
        createdAt: user.createdAt,
        signupPlatform: user.signupPlatform || 'web',
      };

      const token = generateToken({ id: user._id, role: user.role });
      const responseTime = Date.now() - startTime;
      debugLog(`[${startTimeFormatted}] - ✅ USER LOGIN SUCCESSFUL | Total time: ${responseTime}ms | Redis: ${usedRedis}`);
      
      return res.status(200).json({ success: true, message: 'Login successful', token, user: userData });
    }

    try {
      cashier = await Cashier.findByCredentials(email, password);
    } catch (err) {
      // keep for error reporting below
    }

    // --- Cashier Login Success ---
    if (cashier) {
      debugLog(`[${startTimeFormatted}] - ✅ Cashier credentials verified: ${cashier.name}`);

      if (cashier.hasActiveSession()) {
        logError('🚫 Cashier login blocked - active session exists');
        return res.status(403).json({
          success: false,
          message: 'Cashier already logged in from another device. Please logout first.',
          activeSession: cashier.sessionInfo
        });
      }

      await cashier.recordLogin(req.ip, req.get('User-Agent'));
      const userData = {
        name: cashier.name,
        userName: cashier.userName,
        role: process.env.CASHIER_KEY || 'cashier',
        lastLogin: cashier.lastLogin,
      };

      const token = generateToken({ id: cashier._id, role: process.env.CASHIER_KEY || 'cashier', type: 'cashier' });
      const responseTime = Date.now() - startTime;
      debugLog(`[${startTimeFormatted}] - ✅ CASHIER LOGIN SUCCESSFUL | Total time: ${responseTime}ms | Redis: ${usedRedis}`);

      return res.status(200).json({ success: true, message: 'Login successful', token, user: userData });
    }

    // --- Login Failure ---
    logError('❌ LOGIN FAILED - Invalid credentials');
    const userErrorReason = userAuthError?.message || 'N/A';
    const cashierErrorReason = 'Invalid credentials';
    debugLog(`[${startTimeFormatted}] - User Auth Failure: ${userErrorReason}`);
    debugLog(`[${startTimeFormatted}] - Cashier Auth Failure: ${cashierErrorReason}`);
    logError(`⏱️  Failed login time: ${Date.now() - startTime}ms`);

    return res.status(401).json({ success: false, message: 'Invalid credentials' });

  } catch (error) {
    logError('💥 LOGIN ERROR - Server error');
    logError(`📝 Error: ${error.message}`);
    return next(error);
  }
}

module.exports = { login };
