/**
 * SWOT Analysis Tab
 * Generates AI-driven SWOT analysis from verified data
 */

// Generate SWOT analysis
async function generateSWOT() {
    // Show loading states
    const loadingHtml = '<div class="text-center text-gray-400 py-4"><div class="loading-spinner mx-auto mb-2"></div>Analyzing data...</div>';
    document.getElementById('swotStrengths').innerHTML = loadingHtml;
    document.getElementById('swotWeaknesses').innerHTML = loadingHtml;
    document.getElementById('swotOpportunities').innerHTML = loadingHtml;
    document.getElementById('swotThreats').innerHTML = loadingHtml;

    try {
        // Fetch all necessary data
        const [productsRes, sentimentRes] = await Promise.all([
            fetch(`${API_BASE_URL}/products`),
            fetch(`${API_BASE_URL}/sentiment/aggregate`)
        ]);

        if (!productsRes.ok || !sentimentRes.ok) {
            throw new Error('Failed to fetch analysis data');
        }

        const productsData = await productsRes.json();
        const sentimentData = await sentimentRes.json();

        if (!productsData.success || !productsData.data.length) {
            showEmptySWOT();
            return;
        }

        // Enrich products with prices
        const products = await enrichProductsForSWOT(productsData.data);
        const sentimentByProduct = sentimentData.data?.by_product || [];

        // Generate SWOT
        const swot = analyzeSWOT(products, sentimentByProduct);

        // Render SWOT with metadata
        renderSWOT(swot, products.length, sentimentByProduct.length);

    } catch (error) {
        console.error('Failed to generate SWOT:', error);
        const errorHtml = `
            <div class="text-center py-4">
                <div class="text-red-400 mb-2">⚠️ Analysis Failed</div>
                <div class="text-gray-500 text-sm">${error.message}</div>
                <button onclick="generateSWOT()" class="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded text-white text-sm">
                    Retry Analysis
                </button>
            </div>
        `;
        document.getElementById('swotStrengths').innerHTML = errorHtml;
        document.getElementById('swotWeaknesses').innerHTML = '';
        document.getElementById('swotOpportunities').innerHTML = '';
        document.getElementById('swotThreats').innerHTML = '';
    }
}

// Enrich products with price data for SWOT
async function enrichProductsForSWOT(products) {
    const enriched = [];

    for (const product of products) {
        try {
            const pricesRes = await fetch(`${API_BASE_URL}/products/${product.id}/prices`);
            const pricesData = await pricesRes.json();

            const prices = pricesData.data || [];
            const latestPrice = prices.length > 0 ? prices[0].price : null;
            const avgPrice = prices.length > 0
                ? prices.reduce((sum, p) => sum + p.price, 0) / prices.length
                : null;

            enriched.push({
                ...product,
                latestPrice,
                avgPrice,
                priceCount: prices.length
            });
        } catch (error) {
            console.error(`Error enriching product ${product.id}:`, error);
            enriched.push(product);
        }
    }

    return enriched;
}

// Analyze SWOT based on verified data
function analyzeSWOT(products, sentimentByProduct) {
    const swot = {
        strengths: [],
        weaknesses: [],
        opportunities: [],
        threats: []
    };

    // Create sentiment map
    const sentimentMap = {};
    sentimentByProduct.forEach(s => {
        sentimentMap[s.product_id] = s.average_sentiment;
    });

    // Calculate overall average price
    const avgPrice = products
        .filter(p => p.latestPrice)
        .reduce((sum, p) => sum + p.latestPrice, 0) / products.filter(p => p.latestPrice).length;

    // Calculate category-based price averages
    const categoryPrices = {};
    products.forEach(p => {
        if (p.category && p.latestPrice) {
            if (!categoryPrices[p.category]) {
                categoryPrices[p.category] = { total: 0, count: 0, products: [] };
            }
            categoryPrices[p.category].total += p.latestPrice;
            categoryPrices[p.category].count += 1;
            categoryPrices[p.category].products.push(p);
        }
    });

    // Calculate averages for each category
    const categoryAvgPrices = {};
    Object.entries(categoryPrices).forEach(([category, data]) => {
        categoryAvgPrices[category] = data.total / data.count;
    });

    // Analyze each product
    products.forEach(product => {
        const sentiment = sentimentMap[product.id] || 0;
        const price = product.latestPrice;
        const categoryAvg = categoryAvgPrices[product.category];

        // Strengths: High sentiment + competitive price
        if (sentiment > 0.5 && price && price < avgPrice * 1.1) {
            swot.strengths.push(
                `<strong>${product.name}</strong> has excellent sentiment (${sentiment.toFixed(2)}) with competitive pricing ($${price.toFixed(2)})`
            );
        }

        // High sentiment alone
        if (sentiment > 0.6) {
            swot.strengths.push(
                `Strong customer satisfaction for <strong>${product.name}</strong> (score: ${sentiment.toFixed(2)})`
            );
        }

        // Strengths: Price advantage within category
        if (price && categoryAvg && price < categoryAvg * 0.90) {
            swot.strengths.push(
                `<strong>${product.name}</strong> priced 10%+ below ${product.category} average ($${price.toFixed(2)} vs $${categoryAvg.toFixed(2)}) - strong competitive position`
            );
        }

        // Weaknesses: Low sentiment
        if (sentiment < -0.2) {
            swot.weaknesses.push(
                `<strong>${product.name}</strong> shows negative sentiment (${sentiment.toFixed(2)}), indicating customer dissatisfaction`
            );
        }

        // Weaknesses: 10% above category average
        if (price && categoryAvg && price > categoryAvg * 1.10) {
            swot.weaknesses.push(
                `<strong>${product.name}</strong> is priced 10%+ above ${product.category} average ($${price.toFixed(2)} vs $${categoryAvg.toFixed(2)}) - may reduce competitiveness`
            );
        }

        // Weaknesses: High price with low/neutral sentiment
        if (price && price > avgPrice * 1.2 && sentiment < 0.3) {
            swot.weaknesses.push(
                `<strong>${product.name}</strong> is priced high ($${price.toFixed(2)}) but lacks strong positive sentiment`
            );
        }

        // Opportunities: 15% price advantage over competitor average
        if (product.competitor && price) {
            const competitorProducts = products.filter(p =>
                p.competitor === product.competitor && p.id !== product.id && p.latestPrice
            );

            if (competitorProducts.length > 0) {
                const competitorAvgPrice = competitorProducts.reduce((sum, p) => sum + p.latestPrice, 0) / competitorProducts.length;

                if (price < competitorAvgPrice * 0.85) {
                    const diffPercent = (((competitorAvgPrice - price) / competitorAvgPrice) * 100).toFixed(0);
                    swot.opportunities.push(
                        `<strong>Price Advantage:</strong> We are <span class="text-cyan-400 font-bold">${diffPercent}%</span> below <strong>${product.competitor}</strong> in ${product.category} - leverage this in marketing to capture market share`
                    );
                }
            }
        }

        // Opportunities: Moderate sentiment with room for improvement
        if (sentiment >= 0.2 && sentiment <= 0.5) {
            swot.opportunities.push(
                `Improve customer experience for <strong>${product.name}</strong> - current sentiment (${sentiment.toFixed(2)}) suggests room for growth through feature enhancements or better support`
            );
        }

        // Opportunities: High sentiment products for premium positioning
        if (sentiment > 0.7 && price && price > avgPrice * 0.9) {
            swot.opportunities.push(
                `<strong>${product.name}</strong> has strong customer satisfaction (${sentiment.toFixed(2)}) - opportunity to create premium bundle or upsell package based on positive reviews`
            );
        }

        // Opportunities: High volume review gathering (if we have sentiment data)
        if (sentiment > 0.5) {
            swot.opportunities.push(
                `Leverage positive customer sentiment for <strong>${product.name}</strong> in marketing campaigns and social proof strategies`
            );
        }

        // Threats: Competitor products with better metrics
        if (product.competitor) {
            const competitorProducts = products.filter(p =>
                p.competitor === product.competitor && p.id !== product.id
            );

            competitorProducts.forEach(comp => {
                const compSentiment = sentimentMap[comp.id] || 0;
                if (compSentiment > sentiment + 0.3) {
                    swot.threats.push(
                        `<strong>${comp.name}</strong> from ${comp.competitor} outperforms with higher sentiment (${compSentiment.toFixed(2)} vs ${sentiment.toFixed(2)})`
                    );
                }
            });
        }
    });

    // Category-based opportunities with growth focus
    const categories = {};
    products.forEach(p => {
        if (p.category) {
            categories[p.category] = (categories[p.category] || 0) + 1;
        }
    });

    Object.entries(categories).forEach(([category, count]) => {
        if (count === 1) {
            swot.opportunities.push(
                `Expand product line in <strong>${category}</strong> category - currently limited presence (${count} product) presents growth opportunity`
            );
        }
    });

    // Add general insights
    if (products.length < 5) {
        swot.opportunities.push(
            `Limited product portfolio (${products.length} products) - opportunity to expand market coverage`
        );
    }

    // Add default messages if empty
    if (swot.strengths.length === 0) {
        swot.strengths.push('No significant strengths identified yet. Continue collecting data for better insights.');
    }
    if (swot.weaknesses.length === 0) {
        swot.weaknesses.push('No major weaknesses detected. Maintain current quality standards.');
    }
    if (swot.opportunities.length === 0) {
        swot.opportunities.push('Continue monitoring market trends to identify new opportunities.');
    }
    if (swot.threats.length === 0) {
        swot.threats.push('No immediate threats detected. Stay vigilant of market changes.');
    }

    return swot;
}

// Render SWOT
function renderSWOT(swot, productCount, sentimentCount) {
    // Render summary section
    const summarySection = document.getElementById('swotSummary');
    if (summarySection) {
        const coverage = productCount > 0 ? Math.round((sentimentCount / productCount) * 100) : 0;
        summarySection.innerHTML = `
            <div class="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-800/30 rounded-lg border border-gray-700">
                <div class="text-center">
                    <div class="text-2xl font-bold text-cyan-400">${productCount}</div>
                    <div class="text-xs text-gray-400 mt-1">Products Analyzed</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-purple-400">${sentimentCount}</div>
                    <div class="text-xs text-gray-400 mt-1">Sentiment Records</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-green-400">${coverage}%</div>
                    <div class="text-xs text-gray-400 mt-1">Data Coverage</div>
                </div>
            </div>
        `;
    }

    // Render each SWOT quadrant with count badges
    document.getElementById('swotStrengths').innerHTML = formatSWOTSection(swot.strengths, '💪', 'Strengths', 'green');
    document.getElementById('swotWeaknesses').innerHTML = formatSWOTSection(swot.weaknesses, '⚠️', 'Weaknesses', 'yellow');
    document.getElementById('swotOpportunities').innerHTML = formatSWOTSection(swot.opportunities, '💡', 'Opportunities', 'blue');
    document.getElementById('swotThreats').innerHTML = formatSWOTSection(swot.threats, '⚡', 'Threats', 'red');
}

// Format SWOT section with icon and count badge
function formatSWOTSection(items, emoji, label, color) {
    if (items.length === 0) {
        return '<p class="text-gray-500 italic">No items identified</p>';
    }

    const colorClasses = {
        green: 'bg-green-500/20 text-green-400 border-green-500/30',
        yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        red: 'bg-red-500/20 text-red-400 border-red-500/30'
    };

    return `
        <div class="flex items-center gap-2 mb-3">
            <span class="text-2xl">${emoji}</span>
            <span class="text-sm font-semibold text-gray-300">${label}</span>
            <span class="px-2 py-0.5 text-xs rounded-full border ${colorClasses[color]}">${items.length}</span>
        </div>
        <ul class="space-y-2">
            ${items.map(item => `
                <li class="pl-4 border-l-2 border-gray-700 py-1 text-gray-300">
                    ${item}
                </li>
            `).join('')}
        </ul>
    `;
}

// Format SWOT items as list (legacy - kept for compatibility)
function formatSWOTItems(items) {
    if (items.length === 0) {
        return '<p class="text-gray-500">No data available</p>';
    }

    return '<ul>' + items.map(item => `<li>${item}</li>`).join('') + '</ul>';
}

// Show empty SWOT state
function showEmptySWOT() {
    const emptyHtml = '<p class="text-gray-500">No data available. Run a scan to generate SWOT analysis.</p>';

    document.getElementById('swotStrengths').innerHTML = emptyHtml;
    document.getElementById('swotWeaknesses').innerHTML = emptyHtml;
    document.getElementById('swotOpportunities').innerHTML = emptyHtml;
    document.getElementById('swotThreats').innerHTML = emptyHtml;
}
