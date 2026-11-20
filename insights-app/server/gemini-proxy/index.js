// נקודת הכניסה ב־Cloud Run functions. שם הפונקציה: describe
import * as functions from '@google-cloud/functions-framework';
import { readFileSync } from 'node:fs';
import { createHandler } from './handler.js';

const engine = JSON.parse(readFileSync(new URL('./engine.json', import.meta.url), 'utf8'));
const handle = createHandler({ env: process.env, engine });

functions.http('describe', async (req, res) => {
  const forwarded = String(req.headers['x-forwarded-for'] || '');
  const ip = forwarded.split(',')[0].trim() || req.ip || '';
  const out = await handle({ method: req.method, origin: req.headers.origin, ip, body: req.body });
  res.status(out.status).set(out.headers).send(out.body);
});
