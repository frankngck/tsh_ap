const express = require('express');
const db = require('./db');

const bills            = require('./tools/bills');
const suppliers        = require('./tools/suppliers');
const apAgeing         = require('./tools/ap_ageing');
const supplierPayments = require('./tools/supplier_payments');
const cashForecast     = require('./tools/cash_forecast');
const poStatus         = require('./tools/po_status');

const TOOLS = [bills, suppliers, apAgeing, supplierPayments, cashForecast, poStatus];

const app = express();
app.use(express.json());

app.get('/tools', (_req, res) => {
  res.json(TOOLS.map((t) => t.schema));
});

app.post('/execute', async (req, res) => {
  const { name, parameters = {} } = req.body || {};
  if (!name) return res.status(400).json({ success: false, error: 'name is required' });

  const tool = TOOLS.find((t) => t.schema.name === name);
  if (!tool) return res.status(404).json({ success: false, error: `Unknown tool: ${name}` });

  try {
    const data = await tool.handler(parameters);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.MCP_PORT || 3001;

db.authenticate()
  .then(() => {
    console.log('Database connected');
    app.listen(PORT, () => console.log(`MCP server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  });
