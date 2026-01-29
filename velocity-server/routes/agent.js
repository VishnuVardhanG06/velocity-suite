const express = require('express');
const router = express.Router();
const axios = require('axios');
const { dbHelpers } = require('../models/db');

// Python agent URL (from environment or default)
const PYTHON_AGENT_URL = process.env.PYTHON_AGENT_URL || 'http://localhost:8000';

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

        // Send immediate response
        res.json({
            success: true,
            message: 'Scan initiated',
            status: 'running'
        });

        // Trigger Python agent asynchronously (don't await)
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
    try {
        dbHelpers.createLog(
            'Agent Communication',
            'running',
            `Contacting Python agent at ${PYTHON_AGENT_URL}`
        );

        const response = await axios.post(`${PYTHON_AGENT_URL}/scrape`, {
            targets: targets
        }, {
            timeout: 60000 // 60 second timeout
        });

        if (response.data.success) {
            dbHelpers.createLog(
                'Scan Completed',
                'success',
                `Successfully scraped ${response.data.results?.length || 0} items`
            );
        } else {
            dbHelpers.createLog(
                'Scan Warning',
                'error',
                response.data.message || 'Unknown error from Python agent'
            );
        }

    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            dbHelpers.createLog(
                'Agent Unavailable',
                'error',
                `Python agent not running at ${PYTHON_AGENT_URL}. Please start the agent service.`
            );
        } else {
            dbHelpers.createLog(
                'Agent Error',
                'error',
                error.message
            );
        }
        throw error;
    }
}

// GET /api/agent/status - Check agent status (health check)
router.get('/status', async (req, res) => {
    try {
        const response = await axios.get(`${PYTHON_AGENT_URL}/health`, {
            timeout: 5000
        });

        res.json({
            success: true,
            agent_status: 'online',
            agent_url: PYTHON_AGENT_URL,
            agent_data: response.data
        });
    } catch (error) {
        res.json({
            success: false,
            agent_status: 'offline',
            agent_url: PYTHON_AGENT_URL,
            error: error.message
        });
    }
});

module.exports = router;
