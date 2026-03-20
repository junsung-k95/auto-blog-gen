'use strict';

const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(process.cwd(), 'posts');
const MAX_STYLE_CHARS = 8000; // cap total style prompt length

/**
 * Load the most recent past blog posts for style reference.
 * @param {number} maxPosts - max number of posts to include
 * @returns {Promise<Array<{filename: string, content: string}>>}
 */
async function loadStyleExamples(maxPosts = 5) {
  if (!fs.existsSync(POSTS_DIR)) return [];

  const files = fs.readdirSync(POSTS_DIR)
    .filter(f => /\.(md|html|txt)$/i.test(f))
    .map(f => ({
      name: f,
      mtime: fs.statSync(path.join(POSTS_DIR, f)).mtime,
    }))
    .sort((a, b) => b.mtime - a.mtime) // newest first
    .slice(0, maxPosts)
    .map(f => f.name);

  const examples = [];
  for (const filename of files) {
    const content = fs.readFileSync(path.join(POSTS_DIR, filename), 'utf8');
    examples.push({ filename, content });
  }
  return examples;
}

/**
 * Build a style reference prompt from past post examples.
 * @param {Array<{filename: string, content: string}>} examples
 * @returns {string} prompt text describing the writing style
 */
function buildStylePrompt(examples) {
  if (!examples || examples.length === 0) return '';

  let totalChars = 0;
  const parts = [];

  for (const { filename, content } of examples) {
    const header = `--- 과거 포스팅 예시 (${filename}) ---\n`;
    const entry = header + content + '\n';
    if (totalChars + entry.length > MAX_STYLE_CHARS) break;
    parts.push(entry);
    totalChars += entry.length;
  }

  return parts.join('\n');
}

module.exports = { loadStyleExamples, buildStylePrompt };
