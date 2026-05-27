const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

let db;

async function initializeDatabase() {
    db = await open({
        filename: './pg_database.db',
        driver: sqlite3.Database
    });

    // Table des utilisateurs
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            whatsapp_number TEXT UNIQUE,
            balance INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            daily_limit INTEGER DEFAULT 100,
            daily_used INTEGER DEFAULT 0,
            last_reset DATE
        )
    `);

    // Table des transactions
    await db.exec(`
        CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            from_user TEXT,
            to_user TEXT,
            amount INTEGER,
            status TEXT,
            confirmation_code TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            device_id TEXT
        )
    `);

    // Table des logs de sécurité
    await db.exec(`
        CREATE TABLE IF NOT EXISTS security_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_number TEXT,
            action TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            ip_address TEXT
        )
    `);

    return db;
}

module.exports = { initializeDatabase, getDb: () => db };