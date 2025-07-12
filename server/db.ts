
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

// The promise that resolves with the database instance.
let dbPromise: Promise<Database>;

async function initializeDb() {
    // Note: 'db' is a local const here, not a module-level variable
    const db = await open({
        filename: './avalon.db',
        driver: sqlite3.Database
    });

    console.log('Connected to the SQLite database.');

    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS matches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            winner TEXT NOT NULL,
            played_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS player_performance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            match_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            alignment TEXT NOT NULL,
            won BOOLEAN NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (match_id) REFERENCES matches (id)
        );

        CREATE TABLE IF NOT EXISTS user_achievements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            achievement_id TEXT NOT NULL,
            unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(user_id, achievement_id)
        );
    `);
    
    // Add columns if they don't exist for graceful migration
    const columnsToAdd = [
        { name: 'win_streak', type: 'INTEGER DEFAULT 0' },
        { name: 'assassin_kills', type: 'INTEGER DEFAULT 0' },
        { name: 'selected_title', type: 'TEXT' },
        { name: 'selected_border', type: 'TEXT' },
        { name: 'selected_icon', type: 'TEXT' },
    ];
    
    for (const column of columnsToAdd) {
        try {
            await db.exec(`ALTER TABLE users ADD COLUMN ${column.name} ${column.type}`);
            console.log(`Verified column '${column.name}' on users table.`);
        } catch (e: any) {
            // Ignore error if column already exists
            if (!e.message.includes('duplicate column name')) {
                console.error(`Error adding column ${column.name}:`, e.message);
            }
        }
    }


    console.log("Database tables are set up.");
    return db;
}


// Initialize the promise. It will be awaited by the db methods.
dbPromise = initializeDb();

dbPromise.catch(err => {
    console.error('Failed to initialize database:', err);
});

// Export an object of async functions that await the dbPromise before executing.
// This solves the race condition.
const dbInstance = {
    get: async <T>(sql: string, ...params: any[]) => {
        const db = await dbPromise;
        return db.get<T>(sql, ...params);
    },
    all: async <T>(sql: string, ...params: any[]) => {
        const db = await dbPromise;
        return db.all<T>(sql, ...params);
    },
    run: async (sql: string, ...params: any[]) => {
        const db = await dbPromise;
        return db.run(sql, ...params);
    },
    exec: async (sql: string) => {
        const db = await dbPromise;
        return db.exec(sql);
    },
};

export default dbInstance;
