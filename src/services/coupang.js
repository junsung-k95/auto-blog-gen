'use strict';

const crypto = require('crypto');

/**
 * Coupang Partners (affiliate) API client.
 * Requires real API approval. When credentials are missing/unapproved,
 * falls back to constructing a vanilla coupang.com search URL so the
 * write-flow keeps working (no revenue tracking, but no broken UX).
 */

const COUPANG_DOMAIN = 'https://api-gateway.coupang.com';

function getCreds() {
  return {
    accessKey: process.env.COUPANG_ACCESS_KEY,
    secretKey: process.env.COUPANG_SECRET_KEY,
    subId: process.env.COUPANG_SUB_ID || 'auto-blog-gen',
  };
}

function hasCreds() {
  const c = getCreds();
  return !!(c.accessKey && c.secretKey);
}

/** Build HMAC-SHA256 Authorization header per Coupang spec. */
function signRequest(method, urlPath) {
  const { accessKey, secretKey } = getCreds();
  const datetime = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
  const [path, query = ''] = urlPath.split('?');
  const message = datetime + method + path + query;
  const signature = crypto.createHmac('sha256', secretKey).update(message).digest('hex');
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
}

async function callCoupang(method, urlPath, body = null) {
  const auth = signRequest(method, urlPath);
  const res = await fetch(COUPANG_DOMAIN + urlPath, {
    method,
    headers: {
      'Authorization': auth,
      'Content-Type': 'application/json',
      'X-EXTENDED-TIMEOUT': '90000',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Coupang ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Search Coupang Partners products by keyword.
 * Returns up to `limit` products with { name, price, productUrl, productImage, productId }.
 * Falls back to a non-tracked search URL when creds are missing.
 */
async function searchProducts(keyword, limit = 5) {
  if (!keyword) return [];
  if (!hasCreds()) return [fallbackSearchCard(keyword)];
  const { subId } = getCreds();
  try {
    const path = `/v2/providers/affiliate_open_api/apis/openapi/v1/products/search?keyword=${encodeURIComponent(keyword)}&limit=${limit}&subId=${encodeURIComponent(subId)}`;
    const data = await callCoupang('GET', path);
    const items = data?.data?.productData || [];
    return items.slice(0, limit).map(p => ({
      productId: String(p.productId),
      name: p.productName,
      price: p.productPrice,
      productUrl: p.productUrl,
      productImage: p.productImage,
      categoryName: p.categoryName,
      isRocket: !!p.isRocket,
      isFreeShipping: !!p.isFreeShipping,
      shortId: extractShortId(p.productUrl),
    }));
  } catch (err) {
    console.warn('[coupang] search failed, falling back:', err.message);
    return [fallbackSearchCard(keyword)];
  }
}

/**
 * Convert a regular Coupang product URL into a tracked deep link.
 * Falls back to passing the URL through with a subId query param.
 */
async function createDeepLink(productUrl) {
  if (!productUrl) return null;
  if (!hasCreds()) return appendFallbackSubId(productUrl);
  const { subId } = getCreds();
  try {
    const path = '/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink';
    const body = { coupangUrls: [productUrl], subId };
    const data = await callCoupang('POST', path, body);
    return data?.data?.[0]?.shortenUrl || productUrl;
  } catch (err) {
    console.warn('[coupang] deeplink failed, falling back:', err.message);
    return appendFallbackSubId(productUrl);
  }
}

function extractShortId(url) {
  if (!url) return null;
  const m = url.match(/\/(\d+)(?:[?/]|$)/);
  return m ? m[1] : null;
}

function appendFallbackSubId(url) {
  try {
    const u = new URL(url);
    u.searchParams.set('lptag', 'auto-blog-gen');
    return u.toString();
  } catch {
    return url;
  }
}

/** Search-URL fallback card used when partners API is not available. */
function fallbackSearchCard(keyword) {
  const url = `https://www.coupang.com/np/search?q=${encodeURIComponent(keyword)}`;
  return {
    productId: 'search:' + keyword,
    name: `"${keyword}" 쿠팡 검색 결과`,
    price: null,
    productUrl: url,
    productImage: null,
    categoryName: null,
    isRocket: false,
    isFreeShipping: false,
    shortId: null,
    _fallback: true,
  };
}

module.exports = { hasCreds, searchProducts, createDeepLink };
