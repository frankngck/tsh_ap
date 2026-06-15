const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const { verifyToken } = require('../middleware/auth');

router.get('/', verifyToken, supplierController.getAll);
router.get('/:id', verifyToken, supplierController.getById);
router.post('/', verifyToken, supplierController.create);
router.put('/:id', verifyToken, supplierController.update);
router.delete('/:id', verifyToken, supplierController.remove);

module.exports = router;
