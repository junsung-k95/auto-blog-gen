'use strict';

const fs = require('fs');
const path = require('path');
const xmlrpc = require('xmlrpc');

const POSTS_DIR = path.join(process.cwd(), 'posts');

function xmlrpcCall(method, params) {
  return new Promise((resolve, reject) => {
    const client = xmlrpc.createSecureClient({
      host: 'api.blog.naver.com',
      port: 443,
      path: '/xmlrpc',
    });
    client.methodCall(method, params, (err, value) => {
      if (err) reject(err);
      else resolve(value);
    });
  });
}

function htmlToMarkdownLite(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<h2[^>]*>/gi, '\n## ')
    .replace(/<\/h2>/gi, '\n')
    .replace(/<h3[^>]*>/gi, '\n### ')
    .replace(/<\/h3>/gi, '\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gis, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gis, '*$1*')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function safeFilename(title, idx) {
  const clean = (title || `post_${idx}`).replace(/[^\w가-힣\s-]/g, '').trim().slice(0, 60);
  return clean || `post_${idx}`;
}

/**
 * Import recent posts from Naver Blog via XML-RPC.
 * @param {{username, apiPassword, blogId}} creds
 * @param {number} count
 * @returns {Promise<{imported: number, files: string[]}>}
 */
async function importRecentPosts(creds, count = 10) {
  const { username, apiPassword, blogId } = creds;
  if (!username || !apiPassword || !blogId) {
    throw new Error('네이버 자격증명이 설정되어 있지 않습니다.');
  }

  const recent = await xmlrpcCall('metaWeblog.getRecentPosts', [
    blogId, username, apiPassword, count,
  ]);

  if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });

  const files = [];
  recent.forEach((post, i) => {
    const title = post.title || `post_${i + 1}`;
    const md = `# ${title}\n\n${htmlToMarkdownLite(post.description)}`;
    const fname = `${safeFilename(title, i)}.md`;
    fs.writeFileSync(path.join(POSTS_DIR, fname), md, 'utf8');
    files.push(fname);
  });

  return { imported: files.length, files };
}

module.exports = { importRecentPosts };
