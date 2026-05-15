'use strict';

const express = require('express');
const { uploadImage, publishPost } = require('../services/naver');
const { saveHistory } = require('./history');

const router = express.Router();

async function notifySlack(title, postId) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `✅ 새 블로그 포스팅 업로드 완료!\n*제목:* ${title}\n*포스팅 ID:* ${postId}` }),
    });
  } catch (e) {
    console.warn('Slack webhook failed:', e.message);
  }
}

/**
 * POST /api/publish
 * Body (JSON):
 *   - title: string
 *   - content: string — HTML blog post content
 *   - tags: string[]
 *   - category: string (optional)
 *   - publish: boolean (default true)
 *   - images: Array<{ data: string (base64), filename: string, mimeType: string }>
 */
router.post('/publish', async (req, res) => {
  try {
    const { title, content, tags = [], category = '', publish = true, images = [] } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: '제목과 내용은 필수입니다.' });
    }

    let finalContent = content;
    const uploadedUrls = [];

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const buffer = Buffer.from(img.data, 'base64');
      try {
        const url = await uploadImage(buffer, img.filename || `photo${i + 1}.jpg`, img.mimeType || 'image/jpeg');
        uploadedUrls.push(url);
        const imgTag = `<img src="${url}" alt="사진${i + 1}" style="max-width:100%;"/>`;
        finalContent = finalContent.replace(`[사진${i + 1}]`, imgTag);
      } catch (imgErr) {
        console.warn(`Image ${i + 1} upload failed:`, imgErr.message);
      }
    }

    const postId = await publishPost(title, finalContent, tags, category, publish);

    // Fire-and-forget side effects
    const plainText = finalContent.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
    saveHistory({ title, tags, category, postId, preview: plainText }).catch(e =>
      console.warn('history save failed:', e.message)
    );
    notifySlack(title, postId);

    res.json({ success: true, postId, uploadedUrls });
  } catch (err) {
    console.error('publish error:', err.message);
    res.status(500).json({ error: '네이버 블로그 업로드 중 오류가 발생했습니다.', detail: err.message });
  }
});

module.exports = router;
