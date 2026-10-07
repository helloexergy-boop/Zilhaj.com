const { MongoClient } = require('mongodb');

function getMongoUri() {
    const uri = process.env.MONGODB_URI || 
                process.env.SPRING_DATA_MONGODB_URI || 
                'mongodb+srv://rajuranjanxbkj_db_user:mSORiUdT4m8ey11k@cluster0.bwdhkat.mongodb.net/umrah_db?retryWrites=true&w=majority';
    return uri.trim();
}

let clientInstance = null;
let cachedDb = null;
let isConnecting = false;
let connectPromise = null;
let lastHealthCheck = null;

const POOL_CONFIG = {
    maxPoolSize: 20,
    minPoolSize: 2,
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 8000,
    socketTimeoutMS: 45000,
    maxIdleTimeMS: 30000,
    retryWrites: true,
    retryReads: true
};

/**
 * Connect to MongoDB with robust connection pooling and auto-retry logic.
 */
async function connectToDatabase() {
    if (cachedDb && clientInstance) {
        return cachedDb;
    }

    if (isConnecting && connectPromise) {
        return connectPromise;
    }

    isConnecting = true;
    connectPromise = (async () => {
        const uri = getMongoUri();
        let retries = 3;
        while (retries > 0) {
            try {
                clientInstance = new MongoClient(uri, POOL_CONFIG);
                await clientInstance.connect();
                cachedDb = clientInstance.db('umrah_db');

                clientInstance.on('close', () => {
                    console.warn('[DB] MongoDB connection closed. Resetting cached instance.');
                    cachedDb = null;
                    clientInstance = null;
                });

                clientInstance.on('error', (err) => {
                    console.error('[DB] Connection error:', err.message);
                });

                console.log('[DB] Connection pool established successfully (maxPoolSize: 10).');
                isConnecting = false;
                return cachedDb;
            } catch (error) {
                retries--;
                console.error(`[DB] Connection attempt failed (${3 - retries}/3):`, error.message);
                if (retries === 0) {
                    isConnecting = false;
                    connectPromise = null;
                    throw error;
                }
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }
        }
    })();

    return connectPromise;
}

/**
 * Get active Database instance with fast fallback handle.
 */
async function getFastDb() {
    try {
        return await connectToDatabase();
    } catch (err) {
        console.warn('[DB] Fast DB lookup failed, returning null for fallback mode.');
        return null;
    }
}

/**
 * Health check evaluator measuring ping latency, connectivity status, and pool health.
 */
async function getDbHealth() {
    const startTime = Date.now();
    try {
        const db = await connectToDatabase();
        if (!db) {
            return {
                status: 'disconnected',
                latencyMs: -1,
                poolConfig: POOL_CONFIG,
                timestamp: new Date().toISOString()
            };
        }
        await db.command({ ping: 1 });
        const latencyMs = Date.now() - startTime;

        const health = {
            status: latencyMs < 200 ? 'healthy' : 'degraded',
            latencyMs,
            database: 'umrah_db',
            poolConfig: POOL_CONFIG,
            timestamp: new Date().toISOString()
        };
        lastHealthCheck = health;
        return health;
    } catch (err) {
        return {
            status: 'disconnected',
            latencyMs: -1,
            error: err.message,
            poolConfig: POOL_CONFIG,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = {
    connectToDatabase,
    getFastDb,
    getDbHealth,
    POOL_CONFIG
};
