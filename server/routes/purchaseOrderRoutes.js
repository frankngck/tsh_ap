const express = require('express');
const router = express.Router();
const poController = require('../controllers/purchaseOrderController');
const auth = require('../middleware/auth');

router.get('/', auth, poController.getAll);
router.get('/:id', auth, poController.getById);
router.post('/', auth, poController.create);
router.put('/:id', auth, poController.update);
router.put('/:id/send', auth, poController.send);
router.put('/:id/confirm', auth, poController.confirm);
router.put('/:id/cancel', auth, poController.cancel);

module.exports = router;
