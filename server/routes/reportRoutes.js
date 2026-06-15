const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const auth = require('../middleware/auth');

router.get('/outstanding', auth, reportController.outstanding);
router.get('/cashflow', auth, reportController.cashflow);
router.get('/summary', auth, reportController.summary);

module.exports = router;
