import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

let db: Database;

async function initializeDb() {
    db = await open({
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
    `);
    
    console.log("Database tables are set up.");
}

initializeDb().catch(err => {
    console.error('Failed to initialize database:', err);
    (process as any).exit(1);
});

// Wrapper to ensure DB is ready before exporting, now with correct generic handling
const dbInstance = {
    get: <T>(sql: string, ...params: any[]) => db.get<T>(sql, ...params),
    all: <T>(sql: string, ...params: any[]) => db.all<T>(sql, ...params),
    run: (sql: string, ...params: any[]) => db.run(sql, ...params),
};

export default dbInstance;