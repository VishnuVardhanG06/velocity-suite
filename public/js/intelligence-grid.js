/**
 * Intelligence Grid Tab
 * Handles product table with source verification badges
 */

let productsData = [];
let sortColumn = null;
let sortDirection = 'asc';

// Load intelligence grid data
async function loadIntelligenceGrid() {
    const tbody = document.getElementById('intelligenceTableBody');

    // Show loading state
    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="text-center text-gray-400 py-8">
                <div class="loading-spinner mx-auto mb-2"></div>
                Loading intelligence data...
            </td>
        </tr>
    `;

    try {
        const [productsRes, sentimentRes] = await Promise.all([
            fetch(`${API_BASE_URL}/products`),
            fetch(`${API_BASE_URL}/sentiment`)
        ]);

        if (!productsRes.ok || !sentimentRes.ok) {
            throw new Error('Failed to fetch data from server');
        }

        const productsResponse = await productsRes.json();
        const sentimentData = await sentimentRes.json();

        if (productsResponse.success && productsResponse.data.length > 0) {
            // Combine products with their latest prices and sentiments
            const enrichedProducts = await enrichProductsWithData(productsResponse.data);
            productsData = enrichedProducts;
            renderIntelligenceTable(enrichedProducts);
        } else {
            showEmptyTable();
        }

    } catch (error) {
        console.error('Failed to load intelligence grid:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-8">
                    <div class="text-red-400 mb-2">⚠️ Failed to load data</div>
                    <div class="text-gray-500 text-sm">${error.message}</div>
                    <button onclick="loadIntelligenceGrid()" class="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded text-white text-sm">
                        Retry
                    </button>
                </td>
            </tr>
        `;
    }
}

// Enrich products with price and sentiment data
async function enrichProductsWithData(products) {
    const enriched = [];

    for (const product of products) {
        try {
            // Get latest price
            const pricesRes = await fetch(`${API_BASE_URL}/products/${product.id}/prices`);
            const pricesData = await pricesRes.json();

            const latestPrice = pricesData.data && pricesData.data.length > 0
                ? pricesData.data[0]
                : null;

            // Get product sentiment
            const sentimentRes = await fetch(`${API_BASE_URL}/sentiment`);
            const sentimentData = await sentimentRes.json();

            const productSentiments = sentimentData.data
                ? sentimentData.data.filter(s => s.product_id === product.id)
                : [];

            const avgSentiment = productSentiments.length > 0
                ? productSentiments.reduce((sum, s) => sum + s.sentiment_score, 0) / productSentiments.length
                : null;

            const sentimentSource = productSentiments.length > 0
                ? productSentiments[0].source_url
                : null;

            // Extract raw_reviews for tooltip display (first 2 reviews)
            const rawReviews = productSentiments.length > 0 && productSentiments[0].raw_reviews
                ? JSON.parse(productSentiments[0].raw_reviews).slice(0, 2)
                : [];

            enriched.push({
                ...product,
                latestPrice,
                avgSentiment,
                sentimentSource,
                rawReviews  // NEW: For review tooltips
            });
        } catch (error) {
            console.error(`Error enriching product ${product.id}:`, error);
            enriched.push(product);
        }
    }

    return enriched;
}

// Render intelligence table
function renderIntelligenceTable(products) {
    const tbody = document.getElementById('intelligenceTableBody');

    if (products.length === 0) {
        showEmptyTable();
        return;
    }

    // Calculate Category Averages for badges
    const categoryStats = {};
    products.forEach(p => {
        if (p.category && p.latestPrice) {
            if (!categoryStats[p.category]) categoryStats[p.category] = { min: Infinity, max: -Infinity };
            if (p.latestPrice.price < categoryStats[p.category].min) categoryStats[p.category].min = p.latestPrice.price;
            if (p.latestPrice.price > categoryStats[p.category].max) categoryStats[p.category].max = p.latestPrice.price;
        }
    });

    const html = products.map(product => {
        const priceObj = product.latestPrice;
        const price = priceObj
            ? `${priceObj.currency} ${priceObj.price.toFixed(2)}`
            : 'N/A';

        const priceSource = priceObj?.source_url;

        const sentiment = product.avgSentiment !== null && product.avgSentiment !== undefined
            ? product.avgSentiment.toFixed(2)
            : 'N/A';

        const sentimentClass = getSentimentClass(product.avgSentiment);

        // Prepare review tooltip content
        const reviewTooltip = product.rawReviews && product.rawReviews.length > 0
            ? product.rawReviews.map((review, idx) => `<div class="mb-1"><span class="text-cyan-400">${idx + 1}.</span> "${escapeHtml(review.substring(0, 100))}${review.length > 100 ? '...' : ''}"</div>`).join('')
            : '<div class="text-gray-400 italic">No reviews available</div>';

        // Position Badge Logic
        let positionBadge = '';
        if (product.category && priceObj) {
            const stats = categoryStats[product.category];
            if (priceObj.price === stats.min && stats.min !== stats.max) {
                positionBadge = '<span class="px-2 py-1 rounded-md bg-cyan-500/10 text-cyan-400 text-[10px] font-bold border border-cyan-500/20 uppercase tracking-tighter">Market Leader</span>';
            } else if (priceObj.price === stats.max && stats.min !== stats.max) {
                positionBadge = '<span class="px-2 py-1 rounded-md bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20 uppercase tracking-tighter">Premium Tier</span>';
            }
        }

        return `
            <tr>
                <td class="font-semibold text-white">${escapeHtml(product.name)}</td>
                <td>${escapeHtml(product.category || 'N/A')}</td>
                <td>${escapeHtml(product.competitor || 'N/A')}</td>
                <td class="font-mono">${price}</td>
                <td>${positionBadge || '<span class="text-gray-600 text-[10px]">-</span>'}</td>
                <td>
                    ${product.avgSentiment !== null
                ? `<span class="sentiment-indicator ${sentimentClass}">${sentiment}</span>`
                : 'N/A'
            }
                </td>
                <td>
                    <div class="flex gap-2">
                        ${priceSource ? `
                            <a href="${priceSource}" target="_blank" 
                               class="verified-badge verified group relative" 
                               title="Price verified from external source">
                                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                                </svg>
                                <span class="ml-1">Price</span>
                                <div class="tooltip-text hidden group-hover:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-10 border border-cyan-500/20">
                                    Verified from source<br/>
                                    <span class="text-cyan-400 text-[10px]">Click to view source</span>
                                </div>
                            </a>
                        ` : `
                            <span class="verified-badge unverified group relative" 
                                  title="No price source available">
                                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
                                </svg>
                                <span class="ml-1">No Price</span>
                                <div class="tooltip-text hidden group-hover:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-10 border border-red-500/20">
                                    No verified source available
                                </div>
                            </span>
                        `}
                        ${product.sentimentSource ? `
                            <a href="${product.sentimentSource}" target="_blank" 
                               class="verified-badge verified group relative" 
                               title="Sentiment verified from external source">
                                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                                </svg>
                                <span class="ml-1">Sentiment</span>
                                <div class="tooltip-text hidden group-hover:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded w-64 z-10 border border-cyan-500/20 whitespace-normal text-left">
                                    <div class="font-semibold mb-2 text-cyan-400">Customer Reviews:</div>
                                    ${reviewTooltip}
                                    <div class="text-cyan-400 text-[10px] mt-2 text-center">Click to view source</div>
                                </div>
                            </a>
                        ` : ''}
                    </div>
                </td>
                <td class="text-sm">
                    ${product.insight ? `
                        <button onclick="openReviewModal('${product.id}', '${escapeHtml(product.name)}')" 
                                class="flex items-start gap-2 text-left hover:bg-cyan-500/5 p-1 rounded transition-colors group">
                            <svg class="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <span class="text-cyan-400 border-b border-cyan-400/30 group-hover:border-cyan-400">${escapeHtml(product.insight)}</span>
                        </button>
                    ` : '<span class="text-gray-500 italic text-xs">Analyzing market trends...</span>'}
                </td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = html;
}

// Modal logic for review deep-dive
async function openReviewModal(productId, productName) {
    const modal = document.getElementById('reviewModal');
    const infoContainer = document.getElementById('modalProductInfo');
    const reviewList = document.getElementById('modalReviewList');

    infoContainer.innerHTML = `
        <h2 class="text-3xl font-bold text-white mb-2">${productName}</h2>
        <div class="flex items-center gap-2 text-gray-400 italic">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
            </svg>
            Evidence-based strategic deep dive
        </div>
    `;

    reviewList.innerHTML = '<div class="text-center py-8 text-gray-500"><div class="loading-spinner mx-auto mb-2"></div>Loading evidence...</div>';
    modal.classList.remove('hidden');

    try {
        const response = await fetch(`${API_BASE_URL}/sentiment/aggregate`);
        const data = await response.json();
        const productStats = data.data.by_product.find(s => s.product_id == productId);

        if (productStats && productStats.raw_reviews) {
            const reviews = JSON.parse(productStats.raw_reviews);
            reviewList.innerHTML = reviews.map((review, idx) => `
                <div class="p-4 bg-white/5 border border-white/10 rounded-lg relative overflow-hidden group">
                    <div class="absolute top-0 left-0 w-1 h-full bg-cyan-500/50 group-hover:bg-cyan-500 transition-colors"></div>
                    <div class="flex items-start gap-3">
                        <span class="text-cyan-400 font-bold font-mono">0${idx + 1}</span>
                        <p class="text-gray-200 leading-relaxed italic">"${escapeHtml(review)}"</p>
                    </div>
                </div>
            `).join('');
        } else {
            reviewList.innerHTML = '<div class="text-gray-500 text-center py-8 italic">No evidence data found for this product.</div>';
        }
    } catch (error) {
        console.error('Failed to load reviews for modal:', error);
        reviewList.innerHTML = '<div class="text-red-400 text-center py-8">Failed to load evidence details.</div>';
    }
}

function closeReviewModal() {
    document.getElementById('reviewModal').classList.add('hidden');
}

// Show empty table state
function showEmptyTable() {
    const tbody = document.getElementById('intelligenceTableBody');
    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="text-center text-gray-500 py-8">
                No data available. Run a scan to populate the grid.
            </td>
        </tr>
    `;
}

// Get sentiment class
function getSentimentClass(score) {
    if (score === null || score === undefined) return 'sentiment-neutral';
    if (score > 0.3) return 'sentiment-positive';
    if (score < -0.3) return 'sentiment-negative';
    return 'sentiment-neutral';
}

// Search functionality
document.getElementById('searchInput')?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();

    if (!query) {
        renderIntelligenceTable(productsData);
        return;
    }

    const filtered = productsData.filter(product => {
        return product.name.toLowerCase().includes(query) ||
            (product.category && product.category.toLowerCase().includes(query)) ||
            (product.competitor && product.competitor.toLowerCase().includes(query));
    });

    renderIntelligenceTable(filtered);
});

// Table sorting (simplified version)
document.querySelectorAll('.intelligence-table th.sortable').forEach(th => {
    th.addEventListener('click', () => {
        const column = th.dataset.column;

        if (sortColumn === column) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortColumn = column;
            sortDirection = 'asc';
        }

        sortAndRenderTable();
    });
});

function sortAndRenderTable() {
    const sorted = [...productsData].sort((a, b) => {
        let aVal, bVal;

        switch (sortColumn) {
            case 'name':
                aVal = a.name;
                bVal = b.name;
                break;
            case 'category':
                aVal = a.category || '';
                bVal = b.category || '';
                break;
            case 'competitor':
                aVal = a.competitor || '';
                bVal = b.competitor || '';
                break;
            case 'price':
                aVal = a.latestPrice?.price || 0;
                bVal = b.latestPrice?.price || 0;
                break;
            case 'sentiment':
                aVal = a.avgSentiment || 0;
                bVal = b.avgSentiment || 0;
                break;
            default:
                return 0;
        }

        if (typeof aVal === 'string') {
            return sortDirection === 'asc'
                ? aVal.localeCompare(bVal)
                : bVal.localeCompare(aVal);
        } else {
            return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
    });

    renderIntelligenceTable(sorted);
}
