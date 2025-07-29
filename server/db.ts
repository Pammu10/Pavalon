import 'dotenv/config';
import { Pool, QueryResult } from 'pg';

// The promise that resolves with the database instance.
let dbPromise: Promise<Pool>;

// Supabase requires SSL, and this configuration is common for cloud providers
const isProduction = process.env.NODE_ENV === 'production';
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set!');
}

async function initializeDb() {
    console.log('Initializing PostgreSQL connection pool...');
    const pool = new Pool({
        connectionString: connectionString,
        ssl: isProduction ? { rejectUnauthorized: false } : false,
    });

    await pool.query('SELECT NOW()'); // Test the connection
    console.log('Connected to the PostgreSQL database.');
    
    // Use SERIAL for auto-incrementing primary keys in PostgreSQL
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            is_admin BOOLEAN NOT NULL DEFAULT FALSE,
            win_streak INTEGER NOT NULL DEFAULT 0,
            highest_win_streak INTEGER NOT NULL DEFAULT 0,
            assassin_kills INTEGER NOT NULL DEFAULT 0,
            selected_title TEXT,
            selected_border TEXT,
            selected_icon TEXT,
            total_games INTEGER NOT NULL DEFAULT 0,
            total_wins INTEGER NOT NULL DEFAULT 0,
            good_games INTEGER NOT NULL DEFAULT 0,
            good_wins INTEGER NOT NULL DEFAULT 0,
            evil_games INTEGER NOT NULL DEFAULT 0,
            evil_wins INTEGER NOT NULL DEFAULT 0,
            db_defuses INTEGER NOT NULL DEFAULT 0,
            db_futures_played INTEGER NOT NULL DEFAULT 0,
            db_attacks_played INTEGER NOT NULL DEFAULT 0,
            db_fillers_played INTEGER NOT NULL DEFAULT 0,
            selected_background TEXT
        );
        
        CREATE TABLE IF NOT EXISTS matches (
            id SERIAL PRIMARY KEY,
            winner TEXT NOT NULL,
            played_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS player_performance (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
            role TEXT NOT NULL,
            alignment TEXT NOT NULL,
            won BOOLEAN NOT NULL
        );

        CREATE TABLE IF NOT EXISTS user_achievements (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            achievement_id TEXT NOT NULL,
            unlocked_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, achievement_id)
        );

        CREATE TABLE IF NOT EXISTS dragons_breath_matches (
            id SERIAL PRIMARY KEY,
            winner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            loser_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            played_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS friends (
            id SERIAL PRIMARY KEY,
            user1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            user2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status TEXT NOT NULL,
            action_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user1_id, user2_id)
        );
    `);

    console.log("Database tables are set up.");
    return pool;
}

dbPromise = initializeDb();

dbPromise.catch(err => {
    console.error('Failed to initialize database pool:', err);
});

// Export an object of async functions that use the connection pool.
const dbInstance = {
    get: async <T>(sql: string, params: any[] = []): Promise<T | undefined> => {
        const pool = await dbPromise;
        const result = await pool.query(sql, params);
        return result.rows[0];
    },
    all: async <T>(sql: string, params: any[] = []): Promise<T[]> => {
        const pool = await dbPromise;
        const result = await pool.query(sql, params);
        return result.rows;
    },
    run: async (sql: string, params: any[] = []): Promise<QueryResult> => {
        const pool = await dbPromise;
        return pool.query(sql, params);
    },
    exec: async (sql: string): Promise<QueryResult> => {
        const pool = await dbPromise;
        return pool.query(sql);
    },
    transaction: async (callback: (client: { query: (sql: string, params?: any[]) => Promise<QueryResult> }) => Promise<void>) => {
        const pool = await dbPromise;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await callback(client);
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            console.error('Transaction failed, rolled back:', e);
            throw e;
        } finally {
            client.release();
        }
    },
};

export default dbInstance;