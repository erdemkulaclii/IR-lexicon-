import express from 'express';
import { getNews } from '../services/gdelt.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { query = 'international relations', lang = 'en', maxRecords = 20 } = req.query;
    const data = await getNews({ query, lang, maxRecords });
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

export default router;

