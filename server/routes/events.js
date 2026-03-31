import express from 'express';
import { getEventsInRange } from '../services/gdelt.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const {
      query = 'middle east diplomacy OR middle east conflict OR ceasefire',
      lang = 'en',
      startDate,
      endDate,
      maxRecords = 30
    } = req.query;
    const data = await getEventsInRange({ query, lang, startDate, endDate, maxRecords });
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

export default router;

