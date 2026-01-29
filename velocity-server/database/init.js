const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// Initialize database
const dbPath = path.join(__dirname, '..', 'database.db');

async function initializeDatabase() {
    console.log('Initializing Velocity Suite database...');

    const SQL = await initSqlJs();
    const db = new SQL.Database();

    // Read and execute schema
    const schemaSQL = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

    // Split schema into individual statements and execute
    const statements = schemaSQL.split(';').filter(stmt => stmt.trim());
    statements.forEach(stmt => {
        if (stmt.trim()) {
            db.run(stmt);
        }
    });

    console.log('✓ Database schema created successfully');

    // Seed sample data (optional)
    const seedData = () => {
        // Sample products with insights
        const products = [
            ['Wireless Headphones Pro', 'Electronics', 'TechCorp', 'Premium product with strong brand recognition. Monitor competitive pricing.'],
            ['Smart Fitness Watch', 'Wearables', 'FitBrand', 'Growing market segment. Consider expanding feature set to compete.'],
            ['Premium Coffee Maker', 'Home Appliances', 'BrewMaster', 'Solid performance. Opportunity to highlight ease of use in marketing.']
        ];

        products.forEach(product => {
            db.run(`
                INSERT INTO products (name, category, competitor, insight) 
                VALUES (?, ?, ?, ?)
            `, product);
        });

        console.log(`✓ Seeded ${products.length} sample products`);

        // Add initial agent log
        db.run(`
            INSERT INTO agent_logs (action, status, details)
            VALUES (?, ?, ?)
        `, ['System Initialization', 'success', 'Database created and seeded with sample data']);

        console.log('✓ Initial agent log created');
    };

    // Run seeding
    try {
        seedData();
        console.log('\n✅ Database initialization complete!');
        console.log(`Database location: ${dbPath}`);
    } catch (error) {
        console.error('Error seeding data:', error);
    }

    // Save database to file
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);

    console.log('✓ Database saved to disk');
}

// Run initialization
initializeDatabase().catch(error => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
});
