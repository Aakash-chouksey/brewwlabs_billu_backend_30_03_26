const express = require('express');
const router = express.Router();
const rollController = require('../controllers/rollTrackingController');

router.post('/', rollController.addRoll);
router.get('/:outletId', rollController.getRollStats);
router.patch('/:rollId/usage', rollController.updateUsage);

module.exports = router;
