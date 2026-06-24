'use strict';

const express = require('express');
const { getProvider } = require('../services/aiRouter');
const openaiService = require('../services/openai');
const claudeService = require('../services/claude');
const { loadStyleExamples, buildStylePrompt } = require('../services/pastPosts');

/**
 * Factory: returns router with multer upload middleware injected.
 * POST /api/generate — receives images + metadata, streams blog post via SSE.
 *
 * Request body (multipart/form-data):
 *   - images[]: image files (optional, up to 10)
 *   - transcript: string — voice transcription
 *   - memo: string — extra notes
 *   - aiProvider: 'openai' | 'claude' (optional, overrides env)
 *
 * Response: text/event-stream
 *   data: {"chunk":"..."}        — incremental text chunk
 *   data: {"done":true,"usage":{...}}  — final message with token/cost info
 */
module.exports = function (upload) {
  const router = express.Router();

  router.post('/generate', upload.array('images', 10), async (req, res) => {
    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const provider = getProvider(req);
      const transcript = req.body.transcript || '';
      const memo = req.body.memo || '';
      const imageBuffers = (req.files || []).map(f => f.buffer);

      // Load past posts for style reference
      const examples = await loadStyleExamples(5);
      const stylePrompt = buildStylePrompt(examples);

      let result;

      if (provider === 'claude') {
        result = await claudeService.generateBlogPost(
          transcript,
          imageBuffers,
          stylePrompt,
          memo,
          (chunk) => sendEvent({ chunk })
        );
      } else {
        // OpenAI: non-streaming, send full content at once
        result = await openaiService.generateBlogPost(
          transcript,
          imageBuffers,
          stylePrompt,
          memo
        );
        sendEvent({ chunk: result.content });
      }

      // Send usage info
      sendEvent({ done: true, usage: result.usage, provider });
      res.end();
    } catch (err) {
      console.error('generate error:', err.message);
      sendEvent({ error: err.message });
      res.end();
    }
  });

  return router;
};
