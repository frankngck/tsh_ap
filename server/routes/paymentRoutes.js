const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { verifyToken } = require('../middleware/auth');

router.get('/', verifyToken, paymentController.getAll);
router.get('/bill/:billId', verifyToken, paymentController.getByBill);
router.post('/', verifyToken, paymentController.create);

module.exports = router;
