const express = require('express');
const router = express.Router();
const doController = require('../controllers/deliveryOrderController');
const auth = require('../middleware/auth');

router.get('/', auth, doController.getAll);
router.get('/:id', auth, doController.getById);
router.post('/', auth, doController.create);

module.exports = router;
