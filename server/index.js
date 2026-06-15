require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./models');

const authRoutes = require('./routes/authRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const billRoutes = require('./routes/billRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const reportRoutes = require('./routes/reportRoutes');
const purchaseOrderRoutes = require('./routes/purchaseOrderRoutes');
const deliveryOrderRoutes = require('./routes/deliveryOrderRoutes');
const aiRoutes            = require('./routes/aiRoutes');
const reminderRoutes      = require('./routes/reminderRoutes');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/delivery-orders', deliveryOrderRoutes);
app.use('/api/ai',              aiRoutes);
app.use('/api/reminders',       reminderRoutes);

app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found` });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

db.sequelize
  .authenticate()
  .then(() => {
    console.log('Database connection established.');
    return db.sequelize.sync({ alter: true });
  })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`TSH-AP server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  })
  .catch((err) => {
    console.error('Unable to connect to database:', err.message);
    console.log('Server starting without database sync (DB may not be running)...');
    app.listen(PORT, () => {
      console.log(`TSH-AP server running on port ${PORT} (DB offline)`);
    });
  });

module.exports = app;
