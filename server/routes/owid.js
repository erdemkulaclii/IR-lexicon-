import express from 'express';

const router = express.Router();

function parseCsvRows(text) {
  const lines = String(text || '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',');
  const idxEntity = headers.indexOf('Entity');
  const idxCode = headers.indexOf('Code');
  const idxYear = headers.indexOf('Year');
  // Son kolon her zaman numeric olmayabilir (ör. "World region according to OWID")
  // Year'dan sonra gelen ilk "region" olmayan kolonu değer kabul ediyoruz.
  let idxVal = -1;
  for (let i = idxYear + 1; i < headers.length; i++) {
    const h = String(headers[i] || '').toLowerCase();
    if (h.includes('region')) continue;
    idxVal = i;
    break;
  }
  if (idxVal < 0) idxVal = headers.length - 1;

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length <= Math.max(idxCode, idxYear, idxVal)) continue;
    const entity = cols[idxEntity] || '';
    const code = (cols[idxCode] || '').trim().toUpperCase();
    const year = Number(cols[idxYear]);
    const value = Number(cols[idxVal]);
    if (!code || !Number.isFinite(year) || !Number.isFinite(value)) continue;
    rows.push({ entity, code, year, value });
  }
  return rows;
}

router.get('/summary', async (req, res) => {
  try {
    const slug = String(req.query.slug || '').trim();
    const codesRaw = String(req.query.codes || '').trim();
    const year = Number(req.query.year);
    if (!slug) {
      return res.status(400).json({ success: false, error: 'slug gerekli' });
    }
    const codes = new Set(
      codesRaw
        .split(',')
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean)
    );
    if (!codes.size) {
      return res.status(400).json({ success: false, error: 'codes gerekli' });
    }

    const url = `https://ourworldindata.org/grapher/${encodeURIComponent(slug)}.csv`;
    const r = await fetch(url);
    const txt = await r.text();
    if (!r.ok) {
      return res.status(502).json({ success: false, error: `OWID HTTP ${r.status}` });
    }

    const rows = parseCsvRows(txt).filter((x) => codes.has(x.code));
    if (!rows.length) {
      return res.json({ success: true, count: 0, data: null });
    }

    let used = [];
    let yearLabel = 'latest';
    if (Number.isFinite(year)) {
      used = rows.filter((x) => x.year === year);
      if (used.length) yearLabel = String(year);
    }
    if (!used.length) {
      const byCode = new Map();
      for (const row of rows) {
        const prev = byCode.get(row.code);
        if (!prev || row.year > prev.year) byCode.set(row.code, row);
      }
      used = Array.from(byCode.values());
    }

    const values = used.map((x) => x.value);
    const avg = values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);
    const top = [...used]
      .sort((a, b) => b.value - a.value)
      .slice(0, 3)
      .map((x) => ({ code: x.code, value: x.value, year: x.year }));

    res.json({
      success: true,
      count: used.length,
      data: {
        avg,
        yearLabel,
        top
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

export default router;

