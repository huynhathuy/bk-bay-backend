const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const controller = require('../controllers/sellerProductsController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer storage: save files under backend/uploads/<barcode>/filename
const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		const bar = req.params.id || 'common';
		const uploadDir = path.join(__dirname, '..', '..', 'uploads', bar);
		fs.mkdirSync(uploadDir, { recursive: true });
		cb(null, uploadDir);
	},
	filename: function (req, file, cb) {
		// keep original name with timestamp prefix to avoid collisions
		const safe = `${Date.now()}-${file.originalname.replace(/\\s+/g, '_')}`;
		cb(null, safe);
	}
});
const upload = multer({ storage });

// All routes require authentication (seller)
router.get('/', verifyToken, controller.listProducts);
router.get('/:id', verifyToken, controller.getProduct);
router.post('/', verifyToken, controller.createProduct);
router.put('/:id', verifyToken, controller.updateProduct);
router.patch('/:id', verifyToken, controller.patchProduct);
router.delete('/:id', verifyToken, controller.deleteProduct);

module.exports = router;
