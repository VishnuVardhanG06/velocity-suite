const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// Database path
const dbPath = path.join(__dirname, '..', 'database.db');

// Initialize SQL.js database
let db = null;

async function initDatabase() {
    const SQL = await initSqlJs();

    // Load existing database or create new one
    if (fs.existsSync(dbPath)) {
        const buffer = fs.readFileSync(dbPath);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
    }

    // --- AUTO-INITIALIZE TABLES IF THEY DON'T EXIST ---
    db.run(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT,
            competitor TEXT,
            insight TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS prices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER,
            price REAL,
            currency TEXT,
            source_url TEXT,
            scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(product_id) REFERENCES products(id)
        );

        CREATE TABLE IF NOT EXISTS sentiment_facts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER,
            sentiment_score REAL,
            sentiment_text TEXT,
            source_url TEXT,
            raw_reviews TEXT,
            extracted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(product_id) REFERENCES products(id)
        );

        CREATE TABLE IF NOT EXISTS agent_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT,
            status TEXT,
            details TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');

    // Save the schema creation
    saveDatabase();

    return db;
}

// Save database to file
function saveDatabase() {
    if (db) {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbPath, buffer);
    }
}

// Database helper utilities
const dbHelpers = {
    // Products
    getAllProducts: () => {
        const stmt = db.prepare('SELECT * FROM products ORDER BY created_at DESC');
        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
    },

    getProductById: (id) => {
        const stmt = db.prepare('SELECT * FROM products WHERE id = ?');
        stmt.bind([id]);
        let result = null;
        if (stmt.step()) {
            result = stmt.getAsObject();
        }
        stmt.free();
        return result;
    },

    createProduct: (name, category, competitor, insight = null) => {
        db.run('INSERT INTO products (name, category, competitor, insight) VALUES (?, ?, ?, ?)',
            [name, category, competitor, insight]);

        const result = db.exec('SELECT last_insert_rowid() as id');
        const id = result[0].values[0][0];

        saveDatabase();
        return id;
    },

    // Prices
    getPricesByProductId: (productId) => {
        const stmt = db.prepare(`
            SELECT * FROM prices 
            WHERE product_id = ? 
            ORDER BY scraped_at DESC
        `);
        stmt.bind([productId]);
        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
    },

    getLatestPrices: () => {
        const stmt = db.prepare(`
            SELECT p.*, pr.price, pr.currency, pr.source_url, pr.scraped_at
            FROM products p
            LEFT JOIN (
                SELECT product_id, price, currency, source_url, scraped_at,
                       ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY scraped_at DESC) as rn
                FROM prices
            ) pr ON p.id = pr.product_id AND pr.rn = 1
        `);
        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
    },

    createPrice: (productId, price, currency, sourceUrl) => {
        db.run(`
            INSERT INTO prices (product_id, price, currency, source_url) 
            VALUES (?, ?, ?, ?)
        `, [productId, price, currency, sourceUrl]);

        const result = db.exec('SELECT last_insert_rowid() as id');
        const id = result[0].values[0][0];

        saveDatabase();
        return id;
    },

    getAveragePrice: () => {
        const stmt = db.prepare(`
            SELECT AVG(price) as avg_price 
            FROM (
                SELECT product_id, price,
                       ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY scraped_at DESC) as rn
                FROM prices
            ) WHERE rn = 1
        `);
        stmt.step();
        const result = stmt.getAsObject();
        stmt.free();
        return result.avg_price || 0;
    },

    // Sentiment
    getAllSentiment: () => {
        const stmt = db.prepare(`
            SELECT sf.*, p.name as product_name 
            FROM sentiment_facts sf
            JOIN products p ON sf.product_id = p.id
            ORDER BY sf.extracted_at DESC
        `);
        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
    },

    createSentiment: (productId, sentimentScore, sentimentText, sourceUrl, rawReviews = null) => {
        db.run(`
            INSERT INTO sentiment_facts (product_id, sentiment_score, sentiment_text, source_url, raw_reviews)
            VALUES (?, ?, ?, ?, ?)
        `, [productId, sentimentScore, sentimentText, sourceUrl, rawReviews]);

        const result = db.exec('SELECT last_insert_rowid() as id');
        const id = result[0].values[0][0];

        saveDatabase();
        return id;
    },

    getAverageSentiment: () => {
        const stmt = db.prepare(`
            SELECT AVG(sentiment_score) as avg_sentiment 
            FROM sentiment_facts
        `);
        stmt.step();
        const result = stmt.getAsObject();
        stmt.free();
        return result.avg_sentiment || 0;
    },

    // Agent Logs
    getRecentLogs: (limit = 50) => {
        const stmt = db.prepare(`
            SELECT * FROM agent_logs 
            ORDER BY timestamp DESC 
            LIMIT ?
        `);
        stmt.bind([limit]);
        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
    },

    createLog: (action, status, details = null) => {
        db.run(`
            INSERT INTO agent_logs (action, status, details)
            VALUES (?, ?, ?)
        `, [action, status, details]);
        saveDatabase();
    },

    // Analytics
    getProductWithDetails: (productId) => {
        const stmt1 = db.prepare('SELECT * FROM products WHERE id = ?');
        stmt1.bind([productId]);
        let product = null;
        if (stmt1.step()) {
            product = stmt1.getAsObject();
        }
        stmt1.free();

        if (!product) return null;

        const stmt2 = db.prepare(`
            SELECT * FROM prices 
            WHERE product_id = ? 
            ORDER BY scraped_at DESC
        `);
        stmt2.bind([productId]);
        const prices = [];
        while (stmt2.step()) {
            prices.push(stmt2.getAsObject());
        }
        stmt2.free();

        const stmt3 = db.prepare(`
            SELECT * FROM sentiment_facts 
            WHERE product_id = ? 
            ORDER BY extracted_at DESC
        `);
        stmt3.bind([productId]);
        const sentiments = [];
        while (stmt3.step()) {
            sentiments.push(stmt3.getAsObject());
        }
        stmt3.free();

        return {
            ...product,
            prices,
            sentiments
        };
    }
};

module.exports = { initDatabase, saveDatabase, dbHelpers };