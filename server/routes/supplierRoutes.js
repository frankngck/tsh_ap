const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const { verifyToken, requireRole } = require('../middleware/auth');

router.get('/', verifyToken, supplierController.getAll);

// Scorecard — before /:id to avoid route conflict
router.get('/:id/scorecard', verifyToken, requireRole('admin', 'manager'), supplierController.getScorecard);

router.get('/:id', verifyToken, supplierController.getById);
router.post('/', verifyToken, supplierController.create);
router.put('/:id', verifyToken, supplierController.update);
router.delete('/:id', verifyToken, supplierController.remove);

module.exports = router;
