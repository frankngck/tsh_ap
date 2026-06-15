const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const auth = require('../middleware/auth');

router.post('/query',              auth, aiController.query);
router.get('/dashboard-insights',  auth, aiController.dashboardInsights);
router.post('/match-analyse',      auth, aiController.matchAnalyse);

module.exports = router;
