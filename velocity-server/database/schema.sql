-- Velocity Suite Database Schema
-- SQLite database with verified grounding enforcement

-- Products table: Core product catalog
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    competitor TEXT,
    insight TEXT,  -- Business insights for decision-making
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Prices table: Price tracking with mandatory source verification
CREATE TABLE IF NOT EXISTS prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    price REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    source_url TEXT NOT NULL,  -- Verified Grounding: Must have source
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Sentiment Facts table: Consumer sentiment with mandatory source verification
CREATE TABLE IF NOT EXISTS sentiment_facts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    sentiment_score REAL NOT NULL CHECK(sentiment_score >= -1.0 AND sentiment_score <= 1.0),
    sentiment_text TEXT,
    raw_reviews TEXT,  -- JSON array of review texts from live scraping
    source_url TEXT NOT NULL,  -- Verified Grounding: Must have source
    extracted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Agent Logs table: Activity feed for transparency
CREATE TABLE IF NOT EXISTS agent_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    action TEXT NOT NULL,
    status TEXT NOT NULL,  -- 'running', 'success', 'error'
    details TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_prices_product_id ON prices(product_id);
CREATE INDEX IF NOT EXISTS idx_prices_scraped_at ON prices(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_product_id ON sentiment_facts(product_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_timestamp ON agent_logs(timestamp DESC);
