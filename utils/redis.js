const redis = require('redis');
const { logError } = require('./logging');

/**
 * Redis utility functions for caching and session management
 * - Handles Redis connection and reconnection
 * - Provides simple get/set/delete operations
 * - Includes error handling and logging
 */

let client = null;
let isConnected = false;
let errorCount = 0;
const MAX_ERROR_LOGS = 5; // Only log first 5 errors

/**
 * Initialize Redis connection
 * @returns {Promise<void>}
 */
async function connectRedis() {
  try {
    if (!client) {
      // Use Redis Cloud configuration
      client = redis.createClient({
        username: process.env.REDIS_USERNAME || 'default',
        password: process.env.REDIS_PASSWORD || '7d8ebsCmZuauf2rtnAulYUYxhWcMMo3w',
        socket: {
          host: process.env.REDIS_HOST || 'redis-12244.c257.us-east-1-3.ec2.cloud.redislabs.com',
          port: parseInt(process.env.REDIS_PORT) || 12244
        },
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            logError('Redis server connection refused');
            return new Error('Redis server connection refused');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            logError('Redis retry time exhausted');
            return new Error('Retry time exhausted');
          }
          if (options.attempt > 10) {
            logError('Redis max retry attempts reached');
            return undefined;
          }
          // Retry after 1 second
          return Math.min(options.attempt * 100, 3000);
        }
      });

      client.on('error', (err) => {
      if (errorCount < MAX_ERROR_LOGS) {
        logError(`Redis error: ${err.message}`);
        errorCount++;
        if (errorCount === MAX_ERROR_LOGS) {
          console.log('🔇 Redis error logging silenced - too many connection failures');
        }
      }
      isConnected = false;
    });

      client.on('connect', () => {
        console.log('🔗 Redis client connected');
        isConnected = true;
      });

      client.on('ready', () => {
        console.log('✅ Redis client ready and operational');
      });

      client.on('end', () => {
        console.log('🔴 Redis client disconnected');
        isConnected = false;
      });

      await client.connect();
      console.log('🚀 Redis connection established successfully');
    }
  } catch (error) {
    logError(`Redis connection failed: ${error.message}`);
    isConnected = false;
  }
}

/**
 * Get value from Redis
 * @param {string} key - Redis key
 * @returns {Promise<string|null>} - Value or null if not found
 */
async function get(key) {
  try {
    if (!isConnected || !client) {
      return null;
    }
    return await client.get(key);
  } catch (error) {
    logError(`Redis get error for key ${key}: ${error.message}`);
    return null;
  }
}

/**
 * Set value in Redis with optional TTL
 * @param {string} key - Redis key
 * @param {string} value - Redis value
 * @param {number} ttl - Time to live in seconds (optional)
 * @returns {Promise<boolean>} - Success status
 */
async function set(key, value, ttl = null) {
  try {
    if (!isConnected || !client) {
      return false;
    }
    
    if (ttl) {
      await client.setEx(key, ttl, value);
    } else {
      await client.set(key, value);
    }
    return true;
  } catch (error) {
    logError(`Redis set error for key ${key}: ${error.message}`);
    return false;
  }
}

/**
 * Delete key from Redis
 * @param {string} key - Redis key
 * @returns {Promise<boolean>} - Success status
 */
async function del(key) {
  try {
    if (!isConnected || !client) {
      return false;
    }
    await client.del(key);
    return true;
  } catch (error) {
    logError(`Redis delete error for key ${key}: ${error.message}`);
    return false;
  }
}

/**
 * Check if key exists in Redis
 * @param {string} key - Redis key
 * @returns {Promise<boolean>} - Exists status
 */
async function exists(key) {
  try {
    if (!isConnected || !client) {
      return false;
    }
    const result = await client.exists(key);
    return result === 1;
  } catch (error) {
    logError(`Redis exists error for key ${key}: ${error.message}`);
    return false;
  }
}

/**
 * Get JSON object from Redis (auto-parses)
 * @param {string} key - Redis key
 * @returns {Promise<object|null>} - Parsed object or null
 */
async function getJSON(key) {
  if (!isConnected) {
    return getJSONFallback(key);
  }
  try {
    const value = await get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logError(`Redis getJSON error for key ${key}: ${error.message}`);
    return getJSONFallback(key);
  }
}

/**
 * Set JSON object in Redis (auto-stringifies)
 * @param {string} key - Redis key
 * @param {object} value - Object to cache
 * @param {number} ttl - Time to live in seconds (optional)
 * @returns {Promise<boolean>} - Success status
 */
async function setJSON(key, value, ttl = null) {
  if (!isConnected) {
    return setJSONFallback(key, value, ttl);
  }
  try {
    return await set(key, JSON.stringify(value), ttl);
  } catch (error) {
    logError(`Redis setJSON error for key ${key}: ${error.message}`);
    return setJSONFallback(key, value, ttl);
  }
}

/**
 * Close Redis connection
 * @returns {Promise<void>}
 */
async function disconnect() {
  try {
    if (client && isConnected) {
      await client.quit();
      client = null;
      isConnected = false;
    }
  } catch (error) {
    logError(`Redis disconnect error: ${error.message}`);
  }
}

/**
 * Get Redis connection status
 * @returns {boolean} - Connection status
 */
function getConnectionStatus() {
  return isConnected;
}

// Initialize Redis connection on module load
setTimeout(() => {
  connectRedis().then(() => {
    if (isConnected) {
      console.log('🎯 Redis utility initialized and ready for caching');
    } else {
      console.log('⚠️  Redis utility initialized but not connected - will fallback to database');
    }
  }).catch(err => {
    console.log('⚠️  Redis not available - will fallback to database operations');
  });
}, 1000); // Delay to reduce startup spam

// Fallback functions when Redis is not available
async function getJSONFallback(key) {
  console.log(`🗄️ Redis fallback - using database for key: ${key}`);
  return null;
}

async function setJSONFallback(key, value, ttl) {
  console.log(`🗄️ Redis fallback - skipping cache for key: ${key}`);
  return false;
}

/**
 * Delete/clear a key from Redis
 * @param {string} key - Redis key to delete
 * @returns {Promise<boolean>} - Success status
 */
async function clearCache(key) {
  if (!isConnected) {
    console.log(`🗄️ Redis fallback - skipping cache clear for key: ${key}`);
    return false;
  }
  try {
    const result = await del(key);
    return result > 0;
  } catch (error) {
    logError(`Redis clearCache error for key ${key}: ${error.message}`);
    return false;
  }
}

module.exports = {
  connectRedis,
  disconnect,
  get,
  set,
  del,
  exists,
  getJSON,
  setJSON,
  clearCache,
  getConnectionStatus
};
