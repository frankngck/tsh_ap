const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/auth');

router.get('/', auth, paymentController.getAll);
router.get('/bill/:billId', auth, paymentController.getByBill);
router.post('/', auth, paymentController.create);

module.exports = router;
