'use strict';

const express = require('express');
const { transcribeAudio } = require('../services/openai');

/**
 * Factory: returns router with multer upload middleware injected.
 * POST /api/transcribe — receives audio file, returns transcribed text.
 */
module.exports = function (upload) {
  const router = express.Router();

  router.post('/transcribe', upload.single('audio'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: '오디오 파일이 필요합니다.' });
      }
      const text = await transcribeAudio(req.file.buffer, req.file.mimetype);
      res.json({ text });
    } catch (err) {
      console.error('transcribe error:', err.message);
      res.status(500).json({ error: '음성 변환 중 오류가 발생했습니다.', detail: err.message });
    }
  });

  return router;
};
