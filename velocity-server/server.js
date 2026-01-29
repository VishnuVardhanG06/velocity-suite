const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const productsRouter = require('./routes/products');
const sentimentRouter = require('./routes/sentiment');
const agentRouter = require('./routes/agent');
const { initDatabase, dbHelpers } = require('./models/db');

async function startServer() {
    // Initialize database first
    await initDatabase();

    const app = express();
    const PORT = process.env.PORT || 3000;

    // Middleware
    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Request logging
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
        next();
    });

    // Static files (Frontend)
    app.use(express.static(path.join(__dirname, '..', 'public')));

    // API Routes
    app.use('/api/products', productsRouter);
    app.use('/api/sentiment', sentimentRouter);
    app.use('/api/agent', agentRouter);

    // Dashboard analytics endpoint
    app.get('/api/dashboard', (req, res) => {
        try {
            const avgPrice = dbHelpers.getAveragePrice();
            const avgSentiment = dbHelpers.getAverageSentiment();
            const totalProducts = dbHelpers.getAllProducts().length;
            const recentLogs = dbHelpers.getRecentLogs(10);

            res.json({
                success: true,
                data: {
                    kpis: {
                        average_price: avgPrice.toFixed(2),
                        sentiment_score: avgSentiment.toFixed(2),
                        total_products: totalProducts,
                        last_updated: new Date().toISOString()
                    },
                    recent_activity: recentLogs
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Health check
    app.get('/api/health', (req, res) => {
        res.json({
            success: true,
            service: 'velocity-server',
            status: 'healthy',
            timestamp: new Date().toISOString()
        });
    });

    // Error handling middleware
    app.use((err, req, res, next) => {
        console.error('Error:', err);
        res.status(500).json({
            success: false,
            error: err.message || 'Internal server error'
        });
    });

    // 404 handler for API routes
    app.use('/api/*', (req, res) => {
        res.status(404).json({
            success: false,
            error: 'API endpoint not found'
        });
    });

    // Serve index.html for all other routes (SPA support)
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
    });

    // Start server
    app.listen(PORT, () => {
        console.log('╔════════════════════════════════════════════════════════╗');
        console.log('║     VELOCITY SUITE - Grounded Intelligence System     ║');
        console.log('╚════════════════════════════════════════════════════════╝');
        console.log('');
        console.log(`🚀 Server running on: http://localhost:${PORT}`);
        console.log(`📊 API available at: http://localhost:${PORT}/api`);
        console.log(`🤖 Agent endpoint: ${process.env.PYTHON_AGENT_URL || 'http://localhost:8000'}`);
        console.log('');
        console.log('Press Ctrl+C to stop');
        console.log('');
    });
}

// Start the server
startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
