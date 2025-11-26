const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const controller = require('../controllers/sellerProductsController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// All routes require authentication (seller)
router.get('/', verifyToken, controller.listProducts);
router.get('/:id', verifyToken, controller.getProduct);
router.post('/', verifyToken, controller.createProduct);
router.put('/:id', verifyToken, controller.updateProduct);
router.patch('/:id', verifyToken, controller.patchProduct);
router.delete('/:id', verifyToken, controller.deleteProduct);

module.exports = router;
