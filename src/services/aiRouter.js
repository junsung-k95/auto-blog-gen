'use strict';

/**
 * Determine which AI provider to use.
 * Priority: request body/query > env var > default 'openai'
 * @param {object} req - Express request
 * @returns {'openai' | 'claude' | 'codex'}
 */
function getProvider(req) {
  const fromReq = (req.body && req.body.aiProvider) || req.query.aiProvider;
  const fromEnv = process.env.AI_PROVIDER;
  const provider = fromReq || fromEnv || 'openai';
  if (provider === 'claude') return 'claude';
  if (provider === 'claude-cli') return 'claude-cli';
  if (provider === 'codex') return 'codex';
  return 'openai';
}

module.exports = { getProvider };
