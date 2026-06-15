const express = require('express');
const router = express.Router();
const billController = require('../controllers/billController');
const auth = require('../middleware/auth');

router.get('/', auth, billController.getAll);
router.get('/three-way-match', auth, billController.getThreeWayMatchList);
router.get('/:id', auth, billController.getById);
router.post('/', auth, billController.create);
router.put('/:id', auth, billController.update);
router.patch('/:id/approve', auth, billController.approve);
router.patch('/:id/dispute', auth, billController.dispute);
router.post('/:id/match',   auth, billController.matchAnalyse);
router.delete('/:id', auth, billController.remove);

module.exports = router;
