const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { verifyToken } = require('../middleware/auth');

router.get('/outstanding', verifyToken, reportController.outstanding);
router.get('/cashflow', verifyToken, reportController.cashflow);
router.get('/summary', verifyToken, reportController.summary);

module.exports = router;
