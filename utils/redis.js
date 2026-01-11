const redis = require('redis');

// Create Redis client with connection pooling for high-volume requests
const client = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retry_delay_on_failover: 100,
  max_attempts: 3,
  connect_timeout: 60000,
  lazyConnect: true, // Don't connect immediately
  // Connection pooling for high concurrency
  family: 4,
  keepAlive: true,
  // Enable pipelining for high performance
  enable_offline_queue: false,
  // Memory optimization
  maxmemory_policy: 'allkeys-lru'
});

// Handle Redis connection events
client.on('connect', () => {
  console.log('Redis connected successfully');
});

client.on('error', (err) => {
  console.error('Redis connection error:', err);
});

client.on('end', () => {
  console.log('Redis connection ended');
});

// Graceful shutdown
process.on('SIGINT', () => {
  client.quit(() => {
    console.log('Redis client disconnected through app termination');
    process.exit(0);
  });
});

// Promise-based wrapper functions for async/await
const redisAsync = {
  // Get value from Redis
  get: (key) => {
    return new Promise((resolve, reject) => {
      client.get(key, (err, reply) => {
        if (err) reject(err);
        else resolve(reply);
      });
    });
  },

  // Set value with expiration
  setex: (key, seconds, value) => {
    return new Promise((resolve, reject) => {
      client.setex(key, seconds, value, (err, reply) => {
        if (err) reject(err);
        else resolve(reply);
      });
    });
  },

  // Set value without expiration
  set: (key, value) => {
    return new Promise((resolve, reject) => {
      client.set(key, value, (err, reply) => {
        if (err) reject(err);
        else resolve(reply);
      });
    });
  },

  // Delete key
  del: (key) => {
    return new Promise((resolve, reject) => {
      client.del(key, (err, reply) => {
        if (err) reject(err);
        else resolve(reply);
      });
    });
  },

  // Check if key exists
  exists: (key) => {
    return new Promise((resolve, reject) => {
      client.exists(key, (err, reply) => {
        if (err) reject(err);
        else resolve(reply);
      });
    });
  },

  // Set multiple values atomically
  mset: (...args) => {
    return new Promise((resolve, reject) => {
      client.mset(...args, (err, reply) => {
        if (err) reject(err);
        else resolve(reply);
      });
    });
  },

  // Get multiple values
  mget: (...keys) => {
    return new Promise((resolve, reject) => {
      client.mget(...keys, (err, replies) => {
        if (err) reject(err);
        else resolve(replies);
      });
    });
  },

  // Increment value atomically
  incr: (key) => {
    return new Promise((resolve, reject) => {
      client.incr(key, (err, reply) => {
        if (err) reject(err);
        else resolve(reply);
      });
    });
  },

  // Increment by amount atomically
  incrby: (key, increment) => {
    return new Promise((resolve, reject) => {
      client.incrby(key, increment, (err, reply) => {
        if (err) reject(err);
        else resolve(reply);
      });
    });
  },

  // Add to list
  lpush: (key, ...values) => {
    return new Promise((resolve, reject) => {
      client.lpush(key, ...values, (err, reply) => {
        if (err) reject(err);
        else resolve(reply);
      });
    });
  },

  // Remove from list
  lrem: (key, count, value) => {
    return new Promise((resolve, reject) => {
      client.lrem(key, count, value, (err, reply) => {
        if (err) reject(err);
        else resolve(reply);
      });
    });
  },

  // Get list range
  lrange: (key, start, stop) => {
    return new Promise((resolve, reject) => {
      client.lrange(key, start, stop, (err, replies) => {
        if (err) reject(err);
        else resolve(replies);
      });
    });
  },

  // Add to set
  sadd: (key, ...members) => {
    return new Promise((resolve, reject) => {
      client.sadd(key, ...members, (err, reply) => {
        if (err) reject(err);
        else resolve(reply);
      });
    });
  },

  // Remove from set
  srem: (key, ...members) => {
    return new Promise((resolve, reject) => {
      client.srem(key, ...members, (err, reply) => {
        if (err) reject(err);
        else resolve(reply);
      });
    });
  },

  // Check if member exists in set
  sismember: (key, member) => {
    return new Promise((resolve, reject) => {
      client.sismember(key, member, (err, reply) => {
        if (err) reject(err);
        else resolve(reply);
      });
    });
  },

  // Get all set members
  smembers: (key) => {
    return new Promise((resolve, reject) => {
      client.smembers(key, (err, replies) => {
        if (err) reject(err);
        else resolve(replies);
      });
    });
  },

  // Set hash field
  hset: (key, field, value) => {
    return new Promise((resolve, reject) => {
      client.hset(key, field, value, (err, reply) => {
        if (err) reject(err);
        else resolve(reply);
      });
    });
  },

  // Get hash field
  hget: (key, field) => {
    return new Promise((resolve, reject) => {
      client.hget(key, field, (err, reply) => {
        if (err) reject(err);
        else resolve(reply);
      });
    });
  },

  // Get all hash fields
  hgetall: (key) => {
    return new Promise((resolve, reject) => {
      client.hgetall(key, (err, reply) => {
        if (err) reject(err);
        else resolve(reply);
      });
    });
  },

  // Delete hash field
  hdel: (key, field) => {
    return new Promise((resolve, reject) => {
      client.hdel(key, field, (err, reply) => {
        if (err) reject(err);
        else resolve(reply);
      });
    });
  },

  // Flush all data (use with caution!)
  flushall: () => {
    return new Promise((resolve, reject) => {
      client.flushall((err, reply) => {
        if (err) reject(err);
        else resolve(reply);
      });
    });
  },

  // Get Redis info
  info: () => {
    return new Promise((resolve, reject) => {
      client.info((err, reply) => {
        if (err) reject(err);
        else resolve(reply);
      });
    });
  }
};

// Connect to Redis (lazy connection will be established on first use)
const connect = async () => {
  try {
    await client.connect();
    console.log('Redis client connected');
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    throw error;
  }
};

// Export both the raw client and the async wrapper
module.exports = {
  client,
  ...redisAsync,
  connect
};
