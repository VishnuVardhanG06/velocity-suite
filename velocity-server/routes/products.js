const express = require('express');
const router = express.Router();
const { dbHelpers } = require('../models/db');

// GET /api/products - List all products
router.get('/', (req, res) => {
    try {
        const products = dbHelpers.getAllProducts();
        res.json({
            success: true,
            count: products.length,
            data: products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET /api/products/:id - Get product details
router.get('/:id', (req, res) => {
    try {
        const product = dbHelpers.getProductWithDetails(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }

        res.json({
            success: true,
            data: product
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST /api/products - Create product (from agent)
router.post('/', (req, res) => {
    try {
        const { name, category, competitor, insight } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                error: 'Product name is required'
            });
        }

        const productId = dbHelpers.createProduct(name, category, competitor, insight);

        // Log the action
        dbHelpers.createLog(
            'Product Created',
            'success',
            `Created product: ${name} (ID: ${productId})`
        );

        res.status(201).json({
            success: true,
            data: {
                id: productId,
                name,
                category,
                competitor
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET /api/products/:id/prices - Get price history with source URLs
router.get('/:id/prices', (req, res) => {
    try {
        const prices = dbHelpers.getPricesByProductId(req.params.id);

        res.json({
            success: true,
            count: prices.length,
            data: prices
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST /api/products/:id/prices - Add price (from agent)
router.post('/:id/prices', (req, res) => {
    try {
        const { price, currency = 'USD', source_url } = req.body;
        const productId = req.params.id;

        // Verified Grounding: source_url is required
        if (!source_url) {
            return res.status(400).json({
                success: false,
                error: 'source_url is required for verified grounding'
            });
        }

        if (!price || price <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Valid price is required'
            });
        }

        const priceId = dbHelpers.createPrice(productId, price, currency, source_url);

        // Log the action
        const product = dbHelpers.getProductById(productId);
        dbHelpers.createLog(
            'Price Added',
            'success',
            `Added price ${currency} ${price} for ${product.name} (Source: ${source_url})`
        );

        res.status(201).json({
            success: true,
            data: {
                id: priceId,
                product_id: productId,
                price,
                currency,
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

module.exports = router;
