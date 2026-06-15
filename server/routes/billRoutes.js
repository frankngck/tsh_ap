const express = require('express');
const router = express.Router();
const billController = require('../controllers/billController');
const { verifyToken, requireRole } = require('../middleware/auth');

router.get('/', verifyToken, billController.getAll);
router.get('/three-way-match', verifyToken, billController.getThreeWayMatchList);
router.get('/:id', verifyToken, billController.getById);
router.post('/', verifyToken, billController.create);
router.put('/:id', verifyToken, billController.update);

// Tier-1 approve (clerk/admin) — both PATCH and PUT accepted
router.patch('/:id/approve', verifyToken, billController.approveBill);
router.put('/:id/approve',   verifyToken, billController.approveBill);

// Tier-2 manager final approve
router.patch('/:id/manager-approve', verifyToken, requireRole('admin', 'manager'), billController.managerApproveBill);

// Dispute — both PATCH and PUT accepted
router.patch('/:id/dispute', verifyToken, billController.dispute);
router.put('/:id/dispute',   verifyToken, billController.dispute);

router.post('/:id/match', verifyToken, billController.matchAnalyse);
router.delete('/:id', verifyToken, billController.remove);

module.exports = router;
