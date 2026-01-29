/**
 * Main Application Logic
 * Handles tab switching, scan triggers, and global state
 */

const API_BASE_URL = 'http://localhost:3000/api';

// Tab switching
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;

            // Remove active class from all tabs
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked tab
            button.classList.add('active');
            document.getElementById(targetTab).classList.add('active');

            // Refresh data for the active tab
            refreshTabData(targetTab);
        });
    });
}

// Refresh data based on active tab
function refreshTabData(tabId) {
    switch (tabId) {
        case 'market-pulse':
            loadDashboardData();
            loadActivityLogs();
            break;
        case 'intelligence-grid':
            loadIntelligenceGrid();
            break;
        case 'swot-analysis':
            generateSWOT();
            break;
    }
}

// Start Scan button
function initScanButton() {
    const scanBtn = document.getElementById('startScanBtn');
    const agentStatus = document.getElementById('agentStatus');

    scanBtn.addEventListener('click', async () => {
        try {
            scanBtn.disabled = true;
            scanBtn.innerHTML = `
                <div class="loading-spinner mr-2"></div>
                Scanning...
            `;

            // Update status
            agentStatus.innerHTML = `
                <span class="status-dot"></span>
                <span class="text-sm text-gray-300">Agent Running</span>
            `;

            // Trigger scan
            const response = await fetch(`${API_BASE_URL}/agent/start-scan`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    targets: ['default']
                })
            });

            const data = await response.json();

            if (data.success) {
                showNotification('Scan initiated successfully!', 'success');

                // Poll for updates
                startActivityPolling();

                // Refresh after delay
                setTimeout(() => {
                    refreshTabData('market-pulse');
                    loadDashboardData();
                }, 5000);
            } else {
                showNotification('Scan failed: ' + data.error, 'error');
            }

        } catch (error) {
            console.error('Scan error:', error);
            showNotification('Failed to start scan. Is the Python agent running?', 'error');
        } finally {
            setTimeout(() => {
                scanBtn.disabled = false;
                scanBtn.innerHTML = `
                    <svg class="w-5 h-5 mr-2 group-hover:animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                    </svg>
                    Start Scan
                `;

                agentStatus.innerHTML = `
                    <span class="status-dot"></span>
                    <span class="text-sm text-gray-300">Agent Ready</span>
                `;
            }, 2000);
        }
    });
}

// Activity polling
let pollingInterval = null;

function startActivityPolling() {
    if (pollingInterval) return; // Already polling

    pollingInterval = setInterval(() => {
        loadActivityLogs();
        loadDashboardData();
    }, 3000); // Poll every 3 seconds

    // Stop after 1 minute
    setTimeout(() => {
        stopActivityPolling();
    }, 60000);
}

function stopActivityPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

// Notifications
function showNotification(message, type = 'info') {
    // Simple console log for now
    console.log(`[${type.toUpperCase()}] ${message}`);

    // You could implement a toast notification here
}

// Load dashboard data
async function loadDashboardData() {
    try {
        const response = await fetch(`${API_BASE_URL}/dashboard`);
        const data = await response.json();

        if (data.success) {
            const kpis = data.data.kpis;

            // Update KPI cards
            document.getElementById('avgPrice').textContent = `$${kpis.average_price}`;
            document.getElementById('avgSentiment').textContent = kpis.sentiment_score;
            document.getElementById('totalProducts').textContent = kpis.total_products;

            // Format last updated time
            const lastUpdated = new Date(kpis.last_updated);
            document.getElementById('lastUpdated').textContent = formatRelativeTime(lastUpdated);
        }
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
    }
}

// Format relative time
function formatRelativeTime(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // seconds

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initScanButton();
    loadDashboardData();
    loadActivityLogs();

    console.log('🚀 Velocity Suite initialized');
    console.log('💡 Click "Start Scan" to begin autonomous data collection');
});
