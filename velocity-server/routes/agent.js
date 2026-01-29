const express = require('express');
const router = express.Router();
const axios = require('axios');
const { dbHelpers } = require('../models/db');

const getAgentUrl = () => {
    let url = process.env.PYTHON_AGENT_URL || 'http://localhost:8000';
    return url.endsWith('/') ? url.slice(0, -1) : url;
};

// GET /api/agent/logs
router.get('/logs', (req, res) => {
    try {
        const logs = dbHelpers.getRecentLogs(parseInt(req.query.limit) || 50);
        res.json({ success: true, data: logs });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/agent/start-scan
router.post('/start-scan', async (req, res) => {
    try {
        const { targets = ['default'] } = req.body;
        dbHelpers.createLog('Scan Initiated', 'running', `Targets: ${targets.join(', ')}`);

        // Trigger background task
        triggerPythonAgent(targets).catch(err => console.error("Agent Error:", err));

        res.json({ success: true, message: 'Scan started' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

async function triggerPythonAgent(targets) {
    const agentUrl = getAgentUrl();
    try {
        console.log(`[AGENT] Requesting scrape from: ${agentUrl}/scrape`);
        const response = await axios.post(`${agentUrl}/scrape`, {
            target: targets[0]
        }, { timeout: 120000 });

        if (response.data && response.data.results) {
            const results = response.data.results;

            for (const item of results) {
                // 1. Create the Product record
                const productId = dbHelpers.createProduct(
                    item.name,
                    item.category || 'Electronics',
                    item.competitor || 'Market',
                    item.insight || 'AI Generated Insight'
                );

                // 2. Create the Price record linked to the Product ID
                dbHelpers.createPrice(
                    productId,
                    item.price || 0,
                    'USD',
                    item.source_url || ''
                );

                // 3. Create the Sentiment record linked to the Product ID
                dbHelpers.createSentiment(
                    productId,
                    item.sentiment_score || 0,
                    item.sentiment_text || '',
                    item.sentiment_source_url || item.source_url || ''
                );
            }

            dbHelpers.createLog('Scan Completed', 'success', `Processed ${results.length} items.`);
            console.log(`[AGENT] Successfully saved ${results.length} items to multi-table DB.`);
        }
    } catch (error) {
        console.error("[AGENT] Failed:", error.message);
        dbHelpers.createLog('Scan Failed', 'error', error.message);
    }
}

// GET /api/agent/status
router.get('/status', async (req, res) => {
    const agentUrl = getAgentUrl();
    try {
        const response = await axios.get(`${agentUrl}/`, { timeout: 5000 });
        res.json({ success: true, agent_status: 'online', details: response.data });
    } catch (error) {
        res.json({ success: false, agent_status: 'offline', error: error.message });
    }
});

module.exports = router;