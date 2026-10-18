const express = require('express');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const API_URL = process.env.API_URL || 'http://localhost:3001';

app.use(express.static(path.join(__dirname, 'public')));

app.get('/config.js', (req, res) => {
  res.type('application/javascript');
  res.send(`window.API_URL = ${JSON.stringify(API_URL)};`);
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Frontend listening on http://localhost:${PORT}`);
  console.log(`Backend API URL: ${API_URL}`);
});
