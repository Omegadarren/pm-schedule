/**
 * server/routes/publish.js
 * POST /api/publish  →  streams publish script output as Server-Sent Events
 */

const express = require('express');
const { spawn } = require('child_process');
const path    = require('path');

const router = express.Router();

router.post('/', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  const send = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  const scriptPath = path.join(__dirname, '../../scripts/publish.js');
  const child = spawn('node', [scriptPath], {
    cwd: path.join(__dirname, '../..'),
  });

  child.stdout.on('data', (chunk) => send('log', chunk.toString()));
  child.stderr.on('data', (chunk) => send('log', chunk.toString()));

  child.on('close', (code) => {
    send('done', code === 0 ? 'success' : 'error');
    res.end();
  });

  child.on('error', (err) => {
    send('log', `Process error: ${err.message}\n`);
    send('done', 'error');
    res.end();
  });

  req.on('close', () => {
    if (!child.killed) child.kill();
  });
});

module.exports = router;
