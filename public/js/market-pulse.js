// Load Strategic Overview data
async function loadStrategicOverview() {
    const container = document.getElementById('strategicOverview');
    if (!container) return;

    try {
        const [productsRes, sentimentRes] = await Promise.all([
            fetch(`${API_BASE_URL}/products`),
            fetch(`${API_BASE_URL}/sentiment/aggregate`)
        ]);

        const productsData = await productsRes.json();
        const sentimentData = await sentimentRes.json();

        if (!productsData.success || productsData.data.length === 0) {
            container.innerHTML = '';
            return;
        }

        const products = productsData.data;
        const sentimentByProduct = sentimentData.data?.by_product || [];

        // Enrich products with latest prices (bulk fetch for efficiency)
        const enrichedProducts = await Promise.all(products.map(async p => {
            const priceRes = await fetch(`${API_BASE_URL}/products/${p.id}/prices`);
            const priceData = await priceRes.json();
            return {
                ...p,
                latestPrice: priceData.data?.[0]?.price || null,
                sentiment: sentimentByProduct.find(s => s.product_id === p.id)?.average_sentiment || 0
            };
        }));

        // Calculate Category Averages
        const categoryAverages = {};
        enrichedProducts.forEach(p => {
            if (p.category && p.latestPrice) {
                if (!categoryAverages[p.category]) categoryAverages[p.category] = { total: 0, count: 0 };
                categoryAverages[p.category].total += p.latestPrice;
                categoryAverages[p.category].count++;
            }
        });
        Object.keys(categoryAverages).forEach(cat => {
            categoryAverages[cat] = categoryAverages[cat].total / categoryAverages[cat].count;
        });

        // 1. #1 Strength: Highest Sentiment
        const topStrength = enrichedProducts.reduce((prev, current) => (prev.sentiment > current.sentiment) ? prev : current);

        // 2. #1 Opportunity: Biggest Price Gap vs Competitor or Category Average
        let topOpportunity = null;
        let maxGap = -Infinity;

        enrichedProducts.forEach(p => {
            if (!p.latestPrice) return;

            // Check competitor gap
            const competitors = enrichedProducts.filter(other => other.competitor === p.competitor && other.id !== p.id && other.latestPrice);
            if (competitors.length > 0) {
                const compAvg = competitors.reduce((sum, other) => sum + other.latestPrice, 0) / competitors.length;
                const gap = compAvg - p.latestPrice;
                if (gap > maxGap) {
                    maxGap = gap;
                    topOpportunity = { product: p, gap: ((gap / compAvg) * 100).toFixed(0), type: 'competitor', target: p.competitor };
                }
            }

            // Check category gap if no competitor gap found or if category gap is larger
            const catAvg = categoryAverages[p.category];
            if (catAvg) {
                const gap = catAvg - p.latestPrice;
                if (gap > maxGap) {
                    maxGap = gap;
                    topOpportunity = { product: p, gap: ((gap / catAvg) * 100).toFixed(0), type: 'category', target: p.category };
                }
            }
        });

        // Generate Summary Sentences
        const strengthSentence = topStrength
            ? `Our top performer is <span class="text-green-400 font-bold">${escapeHtml(topStrength.name)}</span>, commanding elite market sentiment at <span class="text-green-400 font-bold">${topStrength.sentiment.toFixed(2)}</span>.`
            : "Data collection in progress for market strengths.";

        const opportunitySentence = topOpportunity
            ? `Strategic growth opportunity detected in <span class="text-cyan-400 font-bold">${escapeHtml(topOpportunity.product.name)}</span>, currently maintaining a <span class="text-cyan-400 font-bold">${topOpportunity.gap}%</span> price advantage over <span class="text-cyan-400 font-bold">${escapeHtml(topOpportunity.target)}</span> ${topOpportunity.type === 'category' ? 'category' : ''}.`
            : "Analyzing competitive landscape for price advantages.";

        container.innerHTML = `
            <div class="kpi-card bg-gradient-to-r from-cyan-900/20 to-transparent border-l-4 border-cyan-500">
                <div class="flex items-center gap-4 mb-3">
                    <div class="p-2 bg-cyan-500/10 rounded-lg text-cyan-400">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                        </svg>
                    </div>
                    <h3 class="text-xl font-bold text-white uppercase tracking-wider">Strategic Overview</h3>
                </div>
                <p class="text-lg text-gray-200 leading-relaxed italic">
                    "${strengthSentence} ${opportunitySentence}"
                </p>
            </div>
        `;

    } catch (error) {
        console.error('Failed to load strategic overview:', error);
    }
}

// Load activity logs
async function loadActivityLogs() {
    try {
        const response = await fetch(`${API_BASE_URL}/agent/logs?limit=20`);
        const data = await response.json();

        if (data.success && data.data.length > 0) {
            renderActivityFeed(data.data);
        }
    } catch (error) {
        console.error('Failed to load activity logs:', error);
    }
}

// Render activity feed
function renderActivityFeed(logs) {
    const feedContainer = document.getElementById('activityFeed');
    if (!feedContainer) return;

    if (logs.length === 0) {
        feedContainer.innerHTML = `
            <div class="text-gray-500 text-center py-8">
                No activity yet. Click "Start Scan" to begin.
            </div>
        `;
        return;
    }

    const html = logs.map(log => {
        const statusClass = `status-${log.status}`;
        const timestamp = new Date(log.timestamp);
        const timeStr = formatActivityTime(timestamp);

        return `
            <div class="activity-item">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="font-semibold text-white">${escapeHtml(log.action)}</span>
                            <span class="activity-status ${statusClass}">${log.status}</span>
                        </div>
                        ${log.details ? `<p class="text-gray-400 text-sm">${escapeHtml(log.details)}</p>` : ''}
                    </div>
                    <span class="text-xs text-gray-500 ml-4">${timeStr}</span>
                </div>
            </div>
        `;
    }).join('');

    feedContainer.innerHTML = html;
}

// Format activity timestamp
function formatActivityTime(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 10) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;

    return date.toLocaleTimeString();
}

// Refresh logs button
document.getElementById('refreshLogsBtn')?.addEventListener('click', () => {
    loadActivityLogs();
});

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadStrategicOverview();
    loadActivityLogs(); // Resumed loading logs on start
});
