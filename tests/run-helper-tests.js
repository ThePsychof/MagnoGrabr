// Quick unit-like tests for helpers (categorizeUrl)
import assert from 'node:assert/strict';

function categorizeUrl(url) {
  const lower = url.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|svg)$/.test(lower)) return 'images';
  if (/\.(zip|rar|7z|exe|iso|pdf|mp4|mp3|mkv|flac|torrent)$/.test(lower)) return 'downloads';
  if (/\.(mp4|webm|ogg|mp3|wav|m4a)$/.test(lower)) return 'media';
  if (url.startsWith('#') || /^https?:\/\/[^/]+\/#/.test(url)) return 'anchors';
  return 'others';
}

console.log('Running categorizeUrl tests...');
assert.strictEqual(categorizeUrl('http://example.com/image.png'), 'images');
assert.strictEqual(categorizeUrl('https://site/file.zip'), 'downloads');
assert.strictEqual(categorizeUrl('https://media.com/video.mp4'), 'downloads');
assert.strictEqual(categorizeUrl('#section'), 'anchors');
assert.strictEqual(categorizeUrl('https://example.com/page'), 'others');

console.log('All helper tests passed.');
