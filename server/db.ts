
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
            is_admin BOOLEAN NOT NULL DEFAULT FALSE
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
    `);

    // Add columns if they don't exist for graceful migration
    const columnsToAdd = [
        { name: 'win_streak', type: 'INTEGER NOT NULL DEFAULT 0' },
        { name: 'assassin_kills', type: 'INTEGER NOT NULL DEFAULT 0' },
        { name: 'selected_title', type: 'TEXT' },
        { name: 'selected_border', type: 'TEXT' },
        { name: 'selected_icon', type: 'TEXT' },
        { name: 'is_admin', type: 'BOOLEAN NOT NULL DEFAULT FALSE' },
        { name: 'total_games', type: 'INTEGER NOT NULL DEFAULT 0' },
        { name: 'total_wins', type: 'INTEGER NOT NULL DEFAULT 0' },
        { name: 'good_games', type: 'INTEGER NOT NULL DEFAULT 0' },
        { name: 'good_wins', type: 'INTEGER NOT NULL DEFAULT 0' },
        { name: 'evil_games', type: 'INTEGER NOT NULL DEFAULT 0' },
        { name: 'evil_wins', type: 'INTEGER NOT NULL DEFAULT 0' },
    ];

    for (const column of columnsToAdd) {
        try {
            await pool.query(`ALTER TABLE users ADD COLUMN ${column.name} ${column.type}`);
            console.log(`Verified column '${column.name}' on users table.`);
        } catch (e: any) {
            // Error code for "duplicate column" in PostgreSQL is 42701
            if (e.code !== '42701') {
                console.error(`Error adding column ${column.name}:`, e.message);
            }
        }
    }

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
};

export default dbInstance;