/**
 * server.js
 * ─────────────────────────────────────────────────────────────
 * Minimal static file server for the Wampus World browser client.
 *
 * Responsibilities (server concerns only):
 *   • Serve client/ as a static directory with correct MIME types.
 *   • Ensure JS ES-module files (.js / .mjs) are sent as
 *     "application/javascript" — browsers reject modules served as
 *     text/plain or text/html.
 *   • Serve audio assets (ogg, mp3, wav) and 3-D model assets
 *     (glb, gltf, bin) with the correct content-types so browsers
 *     don't block them.
 *   • Expose a /health endpoint for uptime checks.
 *
 * This file has NO game logic. Do not add game logic here.
 */

import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT ?? 3000;

// ─── MIME type overrides ───────────────────────────────────────
// Express / mime-db usually gets these right, but we pin them
// explicitly so module loading never fails due to a stale system
// mime database.
const MIME_OVERRIDES = {
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  // Audio
  '.mp3':  'audio/mpeg',
  '.ogg':  'audio/ogg',
  '.wav':  'audio/wav',
  '.m4a':  'audio/mp4',
  // 3-D assets
  '.glb':  'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin':  'application/octet-stream',
  // Images / textures
  '.ktx2': 'image/ktx2',
  '.basis':'application/octet-stream',
};

/**
 * setHeaders hook: called by express.static for every file served.
 * Overrides MIME types where our map has an explicit entry.
 */
function setHeaders(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (MIME_OVERRIDES[ext]) {
    res.setHeader('Content-Type', MIME_OVERRIDES[ext]);
  }

  // Allow SharedArrayBuffer (needed for WebAssembly threads / AudioWorklet)
  res.setHeader('Cross-Origin-Opener-Policy',   'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy',  'require-corp');
}

// ─── Static file serving ───────────────────────────────────────
const CLIENT_DIR = path.join(__dirname, '..', 'client', 'public');

app.use(
  express.static(CLIENT_DIR, {
    setHeaders,
    // Do not redirect directory URLs — SPA handles its own routing
    redirect: false,
    // Allow dot-files (e.g. .wasm, future .webp)
    dotfiles: 'allow',
  })
);

// ─── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Catch-all: serve index.html for SPA navigation ───────────
app.get('*path', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.sendFile(path.join(CLIENT_DIR, 'index.html'));
});

// ─── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[server] Wampus World running → http://localhost:${PORT}`);
});

export default app; // for integration tests
