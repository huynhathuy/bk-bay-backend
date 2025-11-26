const express = require('express');
const {
    uploadSingleImage,
    uploadMultipleImages
} = require('../controllers/uploadController');
const verifyToken = require('../middleware/auth');
const router = express.Router();

router.post('/image', uploadSingleImage);
router.post('/images', uploadMultipleImages);

module.exports = router;