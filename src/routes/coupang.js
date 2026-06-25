'use strict';

const express = require('express');
const productMatch = require('../services/productMatch');
const coupang = require('../services/coupang');

const router = express.Router();

/**
 * POST /api/coupang/match
 * Body: { title, content, seedKeyword?, max? }
 * Returns: { queries: [...], products: [{ name, price, productUrl, productImage, _matchedBy }] }
 */
router.post('/coupang/match', async (req, res) => {
  try {
    const { title = '', content = '', seedKeyword = null, max = 6 } = req.body || {};
    const result = await productMatch.matchProducts({ title, content, seedKeyword, max });
    res.json({ ...result, hasApiCreds: coupang.hasCreds() });
  } catch (err) {
    console.error('coupang/match error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/coupang/deeplink
 * Body: { productUrl, product }   product is the card metadata
 * Returns: { url, html, productId, shortId }
 */
router.post('/coupang/deeplink', async (req, res) => {
  try {
    const { productUrl, product } = req.body || {};
    if (!productUrl) return res.status(400).json({ error: 'productUrl 필요' });
    const url = await coupang.createDeepLink(productUrl);
    const html = product ? productMatch.buildProductCardHtml(product, url) : null;
    res.json({ url, html });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
