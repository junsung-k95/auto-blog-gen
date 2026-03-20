'use strict';

/**
 * Determine which AI provider to use.
 * Priority: request body/query > env var > default 'openai'
 * @param {object} req - Express request
 * @returns {'openai' | 'claude'}
 */
function getProvider(req) {
  const fromReq = (req.body && req.body.aiProvider) || req.query.aiProvider;
  const fromEnv = process.env.AI_PROVIDER;
  const provider = fromReq || fromEnv || 'openai';
  return provider === 'claude' ? 'claude' : 'openai';
}

module.exports = { getProvider };
