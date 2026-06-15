const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/reminderController');
const { verifyToken } = require('../middleware/auth');

router.get('/upcoming', verifyToken, ctrl.upcoming);
router.get('/history',  verifyToken, ctrl.history);
router.post('/send',    verifyToken, ctrl.send);

module.exports = router;
