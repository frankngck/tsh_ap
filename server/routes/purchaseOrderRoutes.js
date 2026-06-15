const express = require('express');
const router = express.Router();
const poController = require('../controllers/purchaseOrderController');
const { verifyToken } = require('../middleware/auth');

router.get('/', verifyToken, poController.getAll);
router.get('/:id', verifyToken, poController.getById);
router.post('/', verifyToken, poController.create);
router.put('/:id', verifyToken, poController.update);
router.put('/:id/send', verifyToken, poController.send);
router.put('/:id/confirm', verifyToken, poController.confirm);
router.put('/:id/cancel', verifyToken, poController.cancel);

module.exports = router;
