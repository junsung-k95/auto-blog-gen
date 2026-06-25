'use strict';

const express = require('express');
const seo = require('../services/seo');
const { resolveDisclosure, isMissingDisclosure, disclosureHtml } = require('../services/disclosure');

const router = express.Router();

/**
 * POST /api/seo/score
 * Body: { title, content, primaryKeyword, tags, disclosureKind, hasCoupangLinks }
 * Returns: { total, items, flags, advice, disclosure: {kind, missing, html} }
 */
router.post('/seo/score', (req, res) => {
  try {
    const {
      title = '', content = '', primaryKeyword = '', tags = [],
      disclosureKind = 'none', hasCoupangLinks = false,
    } = req.body || {};
    const score = seo.scorePost({
      title, contentHtml: content, primaryKeyword, tags,
    });
    const effective = resolveDisclosure(disclosureKind, hasCoupangLinks);
    const missing = isMissingDisclosure(effective, content);
    if (missing) {
      score.flags.push({
        severity: 'danger',
        code: 'missing_disclosure',
        message: `${effective === 'sponsored' ? '협찬' : '쿠팡 파트너스'} 공시 문구가 본문에 없습니다.`,
      });
    }
    res.json({
      ...score,
      disclosure: {
        kind: effective,
        missing,
        html: disclosureHtml(effective),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
