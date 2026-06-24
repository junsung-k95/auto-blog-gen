'use strict';

const xmlrpc = require('xmlrpc');
const path = require('path');

const XMLRPC_HOST = 'api.blog.naver.com';
const XMLRPC_PORT = 443;
const XMLRPC_PATH = '/xmlrpc';

function createClient() {
  return xmlrpc.createSecureClient({
    host: XMLRPC_HOST,
    port: XMLRPC_PORT,
    path: XMLRPC_PATH,
  });
}

function call(method, params) {
  return new Promise((resolve, reject) => {
    const client = createClient();
    client.methodCall(method, params, (err, value) => {
      if (err) reject(err);
      else resolve(value);
    });
  });
}

/**
 * Upload an image to Naver Blog via metaWeblog.newMediaObject.
 * @param {Buffer} buffer - image bytes
 * @param {string} filename - e.g. 'photo1.jpg'
 * @param {string} mimeType - e.g. 'image/jpeg'
 * @returns {Promise<string>} URL of uploaded image
 */
async function uploadImage(buffer, filename, mimeType = 'image/jpeg') {
  const username = process.env.NAVER_USERNAME;
  const password = process.env.NAVER_API_PASSWORD;
  const blogId = process.env.NAVER_BLOG_ID;

  const result = await call('metaWeblog.newMediaObject', [
    blogId,
    username,
    password,
    {
      name: filename,
      type: mimeType,
      bits: buffer,
    },
  ]);

  return result.url;
}

/**
 * Publish a post to Naver Blog via metaWeblog.newPost.
 * @param {string} title
 * @param {string} content - HTML content
 * @param {string[]} tags - array of tag strings
 * @param {string} category - category name (optional)
 * @param {boolean} publish - true = public, false = draft
 * @returns {Promise<string>} post ID
 */
async function publishPost(title, content, tags = [], category = '', publish = true) {
  const username = process.env.NAVER_USERNAME;
  const password = process.env.NAVER_API_PASSWORD;
  const blogId = process.env.NAVER_BLOG_ID;

  const post = {
    title,
    description: content,
    categories: category ? [category] : [],
    mt_keywords: tags.join(','),
    dateCreated: new Date(),
  };

  const postId = await call('metaWeblog.newPost', [
    blogId,
    username,
    password,
    post,
    publish,
  ]);

  return String(postId);
}

module.exports = { uploadImage, publishPost };
