import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { exec } from 'node:child_process';
import newsRouter from './routes/news.js';
import eventsRouter from './routes/events.js';
import owidRouter from './routes/owid.js';
import path from 'node:path';

dotenv.config();

const app = express();
const BASE_PORT = Number(process.env.PORT || 3000);
const AUTO_OPEN_BROWSER = String(process.env.AUTO_OPEN_BROWSER || '1') !== '0';

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'ir-lexicon-backend', version: 2 });
});

app.get('/', (_req, res) => {
  res.sendFile(path.resolve('IR_LEXICON.html'));
});

app.use('/api/news', newsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/owid', owidRouter);

function openBrowser(url) {
  try {
    if (process.platform === 'win32') {
      exec(`start "" "${url}"`);
    } else if (process.platform === 'darwin') {
      exec(`open "${url}"`);
    } else {
      exec(`xdg-open "${url}"`);
    }
  } catch (_err) {
    // Browser acma hatasi kritik degil, server calismaya devam etmeli.
  }
}

function listenWithFallback(port, triesLeft = 8) {
  const server = app.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`IR Lexicon backend: ${url}`);
    if (AUTO_OPEN_BROWSER) openBrowser(url);
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE' && triesLeft > 0) {
      const nextPort = port + 1;
      console.warn(`Port ${port} dolu, ${nextPort} deneniyor...`);
      listenWithFallback(nextPort, triesLeft - 1);
      return;
    }
    console.error('Server baslatma hatasi:', err?.message || err);
    process.exit(1);
  });
}

listenWithFallback(BASE_PORT);

