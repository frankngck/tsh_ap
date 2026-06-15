const express = require('express');
const router = express.Router();
const billController = require('../controllers/billController');
const { verifyToken } = require('../middleware/auth');

router.get('/', verifyToken, billController.getAll);
router.get('/three-way-match', verifyToken, billController.getThreeWayMatchList);
router.get('/:id', verifyToken, billController.getById);
router.post('/', verifyToken, billController.create);
router.put('/:id', verifyToken, billController.update);
router.patch('/:id/approve', verifyToken, billController.approve);
router.patch('/:id/dispute', verifyToken, billController.dispute);
router.post('/:id/match',   verifyToken, billController.matchAnalyse);
router.delete('/:id', verifyToken, billController.remove);

module.exports = router;
