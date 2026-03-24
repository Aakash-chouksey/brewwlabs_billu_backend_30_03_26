const express = require('express');
const router = express.Router();
const importController = require('../controllers/importController');
const csvUpload = require('../middlewares/csvUploadMiddleware');

router.post('/products', csvUpload.single('file'), importController.importProducts);
router.post('/inventory', csvUpload.single('file'), importController.importInventory);

module.exports = router;
