const express = require('express');
const router = express.Router();
const axios = require('axios');
const { dbHelpers } = require('../models/db');

// Helper to get the Agent URL dynamically and fix trailing slashes
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
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST /api/agent/log - Create log entry (internal use)
router.post('/log', (req, res) => {
    try {
        const { action, status, details } = req.body;

        if (!action || !status) {
            return res.status(400).json({
                success: false,
                error: 'action and status are required'
            });
        }

        const result = dbHelpers.createLog(action, status, details);

        res.status(201).json({
            success: true,
            data: {
                id: result.lastInsertRowid,
                action,
                status,
                details
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST /api/agent/start-scan - Trigger Python agent workflow
router.post('/start-scan', async (req, res) => {
    try {
        const { targets = ['default'] } = req.body;

        // Log the scan start
        dbHelpers.createLog(
            'Scan Initiated',
            'running',
            `Starting autonomous scan for targets: ${targets.join(', ')}`
        );

        // Send immediate response to frontend so button doesn't spin forever
        res.json({
            success: true,
            message: 'Scan initiated',
            status: 'running'
        });

        // Trigger Python agent asynchronously
        triggerPythonAgent(targets).catch(error => {
            console.error('Python agent error:', error);
            dbHelpers.createLog(
                'Scan Failed',
                'error',
                `Python agent error: ${error.message}`
            );
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Helper function to trigger Python agent
async function triggerPythonAgent(targets) {
    const agentUrl = getAgentUrl();
    try {
        dbHelpers.createLog(
            'Agent Communication',
            'running',
            `Contacting Python agent at ${agentUrl}/scrape`
        );

        // Make the POST request to the Python Agent
        const response = await axios.post(`${agentUrl}/scrape`, {
            target: targets[0] // Sending first target or 'default'
        }, {
            timeout: 90000 // Extended 90 second timeout for cloud scraping
        });

        // The Python agent returns { success: true, results: [...] }
        if (response.data && response.data.results) {
            const results = response.data.results;

            // Save results to database (assuming dbHelpers has this)
            if (dbHelpers.saveScrapedData) {
                dbHelpers.saveScrapedData(results);
            }

            dbHelpers.createLog(
                'Scan Completed',
                'success',
                `Successfully scraped ${results.length} items from the AI Agent`
            );
        } else {
            throw new Error('Invalid response format from Python Agent');
        }

    } catch (error) {
        const errorMsg = error.response ? `Agent responded with ${error.response.status}` : error.message;
        dbHelpers.createLog(
            'Agent Error',
            'error',
            `Communication failure: ${errorMsg}`
        );
        console.error('Agent Trigger Error:', errorMsg);
    }
}

// GET /api/agent/status - Check agent status
router.get('/status', async (req, res) => {
    const agentUrl = getAgentUrl();
    try {
        const response = await axios.get(`${agentUrl}/`, {
            timeout: 5000
        });

        res.json({
            success: true,
            agent_status: 'online',
            agent_url: agentUrl,
            agent_data: response.data
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