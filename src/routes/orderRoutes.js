const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');

const { 
    createOrder, 
    getOrderDetails, 
    getTopSellingProducts,
    getSellerOrders,
    updateOrderStatus
} = require('../controllers/orderController');

// Public routes
router.post('/', verifyToken, createOrder);
router.get('/details', verifyToken, getOrderDetails);
router.get('/reports/top-selling', verifyToken, getTopSellingProducts);
router.get('/seller', verifyToken, getSellerOrders);
router.patch('/:orderId/status', verifyToken, updateOrderStatus);

module.exports = router;