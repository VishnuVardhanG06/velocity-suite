const express = require('express');
const router = express.Router();
const { dbHelpers } = require('../models/db');

// GET /api/sentiment - Get all sentiment facts
router.get('/', (req, res) => {
    try {
        const sentiments = dbHelpers.getAllSentiment();
        res.json({
            success: true,
            count: sentiments.length,
            data: sentiments
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST /api/sentiment - Create sentiment fact (from agent)
router.post('/', (req, res) => {
    try {
        const { product_id, sentiment_score, sentiment_text, source_url, raw_reviews } = req.body;

        // Verified Grounding: source_url is required
        if (!source_url) {
            return res.status(400).json({
                success: false,
                error: 'source_url is required for verified grounding'
            });
        }

        // Validate sentiment score range
        if (sentiment_score === undefined || sentiment_score < -1.0 || sentiment_score > 1.0) {
            return res.status(400).json({
                success: false,
                error: 'sentiment_score must be between -1.0 and 1.0'
            });
        }

        if (!product_id) {
            return res.status(400).json({
                success: false,
                error: 'product_id is required'
            });
        }

        // Convert raw_reviews array to JSON string for storage
        const rawReviewsJson = raw_reviews ? JSON.stringify(raw_reviews) : null;

        const sentimentId = dbHelpers.createSentiment(
            product_id,
            sentiment_score,
            sentiment_text,
            source_url,
            rawReviewsJson
        );

        // Log the action
        const product = dbHelpers.getProductById(product_id);
        const sentimentLabel = sentiment_score > 0 ? 'Positive' : sentiment_score < 0 ? 'Negative' : 'Neutral';

        dbHelpers.createLog(
            'Sentiment Added',
            'success',
            `Added ${sentimentLabel} sentiment (${sentiment_score}) for ${product.name} (Source: ${source_url})`
        );

        res.status(201).json({
            success: true,
            data: {
                id: sentimentId,
                product_id,
                sentiment_score,
                sentiment_text,
                source_url
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET /api/sentiment/aggregate - Calculate average sentiment score
router.get('/aggregate', (req, res) => {
    try {
        const avgSentiment = dbHelpers.getAverageSentiment();

        // Calculate sentiment by product
        const sentimentByProduct = dbHelpers.getAllSentiment().reduce((acc, item) => {
            if (!acc[item.product_id]) {
                acc[item.product_id] = {
                    product_id: item.product_id,
                    product_name: item.product_name,
                    scores: [],
                    count: 0
                };
            }
            acc[item.product_id].scores.push(item.sentiment_score);
            acc[item.product_id].count++;
            return acc;
        }, {});

        // Calculate averages
        const productSentiments = Object.values(sentimentByProduct).map(p => ({
            product_id: p.product_id,
            product_name: p.product_name,
            average_sentiment: p.scores.reduce((a, b) => a + b, 0) / p.count,
            count: p.count
        }));

        res.json({
            success: true,
            data: {
                overall_average: avgSentiment,
                by_product: productSentiments
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
