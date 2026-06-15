const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const auth = require('../middleware/auth');

router.get('/', auth, supplierController.getAll);
router.get('/:id', auth, supplierController.getById);
router.post('/', auth, supplierController.create);
router.put('/:id', auth, supplierController.update);
router.delete('/:id', auth, supplierController.remove);

module.exports = router;
