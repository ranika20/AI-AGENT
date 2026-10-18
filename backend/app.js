const express = require('express');
const dotenv = require('dotenv');
const configRoutes = require('./routes/configRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const investigationRoutes = require('./routes/investigationRoutes');

dotenv.config();

const app = express();

app.use(express.json());
app.use(configRoutes);
app.use(serviceRoutes);
app.use(investigationRoutes);

module.exports = app;
