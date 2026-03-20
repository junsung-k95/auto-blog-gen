'use strict';

const express = require('express');
const { uploadImage, publishPost } = require('../services/naver');

const router = express.Router();

/**
 * POST /api/publish
 * Body (JSON):
 *   - title: string
 *   - content: string — HTML blog post content
 *   - tags: string[] — hashtag array
 *   - category: string (optional)
 *   - publish: boolean (default true)
 *   - images: Array<{ data: string (base64), filename: string, mimeType: string }>
 *             Images to upload to Naver and embed in content
 */
router.post('/publish', async (req, res) => {
  try {
    const { title, content, tags = [], category = '', publish = true, images = [] } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: '제목과 내용은 필수입니다.' });
    }

    // Upload images to Naver and replace placeholders in content
    let finalContent = content;
    const uploadedUrls = [];

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const buffer = Buffer.from(img.data, 'base64');
      try {
        const url = await uploadImage(buffer, img.filename || `photo${i + 1}.jpg`, img.mimeType || 'image/jpeg');
        uploadedUrls.push(url);
        // Replace [사진N] placeholder with actual img tag
        const placeholder = `[사진${i + 1}]`;
        const imgTag = `<img src="${url}" alt="사진${i + 1}" style="max-width:100%;"/>`;
        finalContent = finalContent.replace(placeholder, imgTag);
      } catch (imgErr) {
        console.warn(`Image ${i + 1} upload failed:`, imgErr.message);
        // Continue without this image
      }
    }

    const postId = await publishPost(title, finalContent, tags, category, publish);
    res.json({ success: true, postId, uploadedUrls });
  } catch (err) {
    console.error('publish error:', err.message);
    res.status(500).json({ error: '네이버 블로그 업로드 중 오류가 발생했습니다.', detail: err.message });
  }
});

module.exports = router;
