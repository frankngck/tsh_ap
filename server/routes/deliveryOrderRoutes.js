const express = require('express');
const router = express.Router();
const doController = require('../controllers/deliveryOrderController');
const { verifyToken } = require('../middleware/auth');

router.get('/', verifyToken, doController.getAll);
router.get('/:id', verifyToken, doController.getById);
router.post('/', verifyToken, doController.create);

module.exports = router;
