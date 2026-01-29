const express = require('express');
const router = express.Router();
const axios = require('axios');
const { dbHelpers } = require('../models/db');

/**
 * Helper to dynamically get Agent URL and clean trailing slashes
 */
const getAgentUrl = () => {
    let url = process.env.PYTHON_AGENT_URL || 'http://localhost:8000';
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    return url;
};

// GET /api/agent/logs - Retrieve activity feed
router.get('/logs', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const logs = dbHelpers.getRecentLogs(limit);
        res.json({
            success: true,
            count: logs.length,
            data: logs
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/agent/start-scan - Trigger Python agent workflow
router.post('/start-scan', async (req, res) => {
    try {
        const { targets = ['default'] } = req.body;

        // 1. Log the initiation in the DB
        dbHelpers.createLog(
            'Scan Initiated',
            'running',
            `Starting autonomous scan for: ${targets.join(', ')}`
        );

        // 2. Respond to frontend immediately so the UI stays responsive
        res.json({
            success: true,
            message: 'Scan initiated successfully',
            status: 'running'
        });

        // 3. Run the heavy lifting in the background
        triggerPythonAgent(targets).catch(err => {
            console.error('Background Agent Error:', err.message);
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Helper function to communicate with Python AI Agent
 */
async function triggerPythonAgent(targets) {
    const agentUrl = getAgentUrl();
    const endpoint = `${agentUrl}/scrape`;

    try {
        console.log(`[AGENT] Contacting Python AI at: ${endpoint}`);

        dbHelpers.createLog('Agent Communication', 'running', `Requesting data from AI engine...`);

        // Trigger the Python Scraper
        const response = await axios.post(endpoint, {
            target: targets[0] || 'default'
        }, {
            timeout: 120000 // 2 minute timeout for cloud browser startup
        });

        if (response.data && response.data.results) {
            const results = response.data.results;
            console.log(`[AGENT] AI returned ${results.length} products.`);

            // Save each item to the database
            // Note: Ensure your db.js has a createProduct function
            results.forEach(item => {
                try {
                    dbHelpers.createProduct(
                        item.name,
                        item.category || 'General',
                        item.competitor || 'Unknown',
                        item.price || 0,
                        item.sentiment_score || 0,
                        item.sentiment_text || '',
                        item.insight || '',
                        item.source_url || ''
                    );
                } catch (dbErr) {
                    console.error('[DATABASE] Failed to save item:', item.name, dbErr.message);
                }
            });

            dbHelpers.createLog(
                'Scan Completed',
                'success',
                `Successfully processed ${results.length} new items.`
            );
        } else {
            throw new Error('AI Agent returned an empty or invalid data format.');
        }

    } catch (error) {
        const errorMsg = error.response ? `Agent Error (${error.response.status})` : error.message;
        console.error(`[AGENT] Connection Failed: ${errorMsg}`);

        dbHelpers.createLog(
            'Scan Failed',
            'error',
            `Communication failure: ${errorMsg}`
        );
    }
}

// GET /api/agent/status - Check health of the AI Agent
router.get('/status', async (req, res) => {
    const agentUrl = getAgentUrl();
    try {
        const response = await axios.get(`${agentUrl}/`, { timeout: 5000 });
        res.json({
            success: true,
            agent_status: 'online',
            agent_url: agentUrl,
            details: response.data
        });
    } catch (error) {
        res.json({
            success: false,
            agent_status: 'offline',
            agent_url: agentUrl,
            error: error.message
        });
    }
});

module.exports = router;