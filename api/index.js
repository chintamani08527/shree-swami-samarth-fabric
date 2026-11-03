import { app } from '../server/dist/app.js';
import { ensureDatabaseReady } from '../server/dist/db/prisma.js';

let isReady = false;

export default function handler(req, res) {
  if (!isReady) {
    isReady = true;
    ensureDatabaseReady().catch((err) => {
      console.warn('Background ensureDatabaseReady warning:', err);
    });
  }

  // Ensure Express router gets the expected /api path
  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url}`;
  }

  return app(req, res);
}
