const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { verifyToken } = require('../middleware/auth');

router.post('/query',              verifyToken, aiController.query);
router.get('/dashboard-insights',  verifyToken, aiController.dashboardInsights);
router.post('/match-analyse',      verifyToken, aiController.matchAnalyse);

module.exports = router;
