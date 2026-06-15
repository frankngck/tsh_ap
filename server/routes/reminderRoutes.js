const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/reminderController');
const auth       = require('../middleware/auth');

router.get('/upcoming', auth, ctrl.upcoming);
router.get('/history',  auth, ctrl.history);
router.post('/send',    auth, ctrl.send);

module.exports = router;
