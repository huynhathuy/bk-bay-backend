const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');

const {
    getCartItems,
    addVariationToCart,
    deleteCartItem
} = require('../controllers/cartController');

router.get('/items', verifyToken, getCartItems);
router.post('/', verifyToken, addVariationToCart);
router.delete('/', verifyToken, deleteCartItem);

module.exports = router;