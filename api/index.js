import { app } from '../server/dist/app.js';
import { ensureDatabaseReady } from '../server/dist/db/prisma.js';

let isReady = false;

export default async function handler(req, res) {
  if (!isReady) {
    try {
      await ensureDatabaseReady();
    } catch (err) {
      console.error('Failed to ensure database ready:', err);
    }
    isReady = true;
  }

  // Ensure Express router gets the expected /api path
  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url}`;
  }

  return app(req, res);
}
