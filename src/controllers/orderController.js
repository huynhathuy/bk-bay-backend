const orderModel = require('../models/Order');
const userModel = require('../models/User');
const userUtils = require('../utils/userUtils');

//@desc   Create a new order
//@route  POST /api/orders
//@access Private
const createOrder = async (req, res) => {
  try {
    const buyerId = req.user?.Id;
    if (!buyerId) { 
        return res.status(401).json({ success: false, message: 'Authentication required: Buyer ID not available' });
    }
    const role = await userModel.checkRole(buyerId);
    if (role !== 'buyer' && role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // For current DB schema we require orderId and orderItemId to link the review via Write_review
    const {
        address,
        status,
        quantity,
        price,
        barcode,
        variationname
    } = req.body;
    if (!address || !quantity || !price || !barcode || !variationname) {
        return res.status(400).json({ 
            success: false, 
            message: 'Missing required fields: address, quantity, price, barcode, and variationname.' 
        });
    }

    const created = await orderModel.createOrder({
        buyerId,
        address,
        status: status || 'Pending', // Giá trị mặc định nếu không có status
        quantity: parseInt(quantity, 10),
        price: Number(price),
        barcode,
        variationname
    });

    res.status(201).json({ success: true, message: 'Order created', order: created });
  } catch (err) {
    console.error('CREATE ORDER ERROR:', err);
    if (err.message && (err.message.includes('required') || err.message.includes('Cannot insert the value NULL'))) {
        return res.status(400).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: 'Failed to create order', error: err.message });
  }
};

/**
 * @desc Lấy danh sách Order chi tiết có lọc
 * @route GET /api/orders/details
 * @access Private (Dành cho Admin/Quản lý)
 */
const getOrderDetails = async (req, res) => {
    try {
        // 1. Kiểm tra Quyền truy cập (Authorization)
        // 2. Lấy tham số lọc từ Query Parameters
        const statusFilter = req.query.status || null; // statusFilter có thể là 'Pending', 'Delivered', v.v.
        const minItems = parseInt(req.query.minItems) || 0; 

        const orders = await orderModel.getOrderDetails(statusFilter, minItems);

        res.status(200).json({
            success: true,
            count: orders.length,
            data: orders
        });
    } catch (err) {
        console.error('GET ORDER DETAILS ERROR:', err.message);
        
        // Xử lý lỗi hệ thống hoặc lỗi từ SP (ví dụ: lỗi TRY...CATCH trong SP)
        if (err.message.includes('Database Error')) { 
             return res.status(503).json({ success: false, message: 'Database query failed.', error: err.message });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Failed to retrieve order details.', 
            error: err.message 
        });
    }
};

/**
 * @desc Lấy báo cáo sản phẩm bán chạy nhất, có lọc theo số lượng và Seller.
 * @route GET /api/orders/reports/top-selling
 * @access Private (Thường dành cho Seller/Admin)
 */
const getTopSellingProducts = async (req, res) => {
    try {
        // Kiểm tra Quyền truy cập (Authorization)
        const requestorId = req.user?.Id;
        // (Nếu req.user là Seller, chỉ được xem sản phẩm của mình)
        // (Nếu req.user là Admin, có thể xem sản phẩm của Seller khác bằng cách dùng req.query.sellerId)

        const minQuantity = parseInt(req.query.minQuantity) || 0; 
        
        // Nếu là Seller, SellerId phải là ID của chính họ. Nếu là Admin, có thể lọc theo Seller khác.
        // Giả định: Controller này chỉ dành cho Seller/Admin.
        const sellerIdFilter = req.query.sellerId || requestorId || null; 
        const products = await orderModel.getTopSellingProducts(minQuantity, sellerIdFilter);

        res.status(200).json({
            success: true,
            count: products.length,
            data: products
        });

    } catch (err) {
        console.error('GET TOP SELLING PRODUCTS ERROR:', err.message);
        
        if (err.message.includes('Database Error')) { 
             return res.status(503).json({ success: false, message: 'Database query failed.', error: err.message });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Failed to retrieve top selling products report.', 
            error: err.message 
        });
    }
};


/**
 * @desc Get orders for a specific seller (orders containing seller's products)
 * @route GET /api/orders/seller
 * @access Private (Seller only)
 */
const getSellerOrders = async (req, res) => {
    try {
        const sellerId = req.user?.Id;
        if (!sellerId) {
            return res.status(401).json({ success: false, message: 'Authentication required: Seller ID not available' });
        }

        const role = await userModel.checkRole(sellerId);
        if (role !== 'seller' && role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied: Seller role required' });
        }

        // Get query parameters for filtering
        const statusFilter = req.query.status || null;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        const search = req.query.search || null;

        const orders = await orderModel.getSellerOrders(sellerId, { statusFilter, limit, offset, search });

        res.status(200).json({
            success: true,
            count: orders.length,
            orders: orders
        });
    } catch (err) {
        console.error('GET SELLER ORDERS ERROR:', err.message);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve seller orders.',
            error: err.message
        });
    }
};

/**
 * @desc Update order status
 * @route PATCH /api/orders/:orderId/status
 * @access Private (Seller/Admin)
 */
const updateOrderStatus = async (req, res) => {
    try {
        const userId = req.user?.Id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const role = await userModel.checkRole(userId);
        if (role !== 'seller' && role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { orderId } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ success: false, message: 'Status is required' });
        }

        // Validate status value
        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                success: false, 
                message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
            });
        }

        const updated = await orderModel.updateOrderStatus(orderId, status, userId, role);

        res.status(200).json({
            success: true,
            message: 'Order status updated successfully',
            order: updated
        });
    } catch (err) {
        console.error('UPDATE ORDER STATUS ERROR:', err.message);
        
        if (err.message.includes('not found')) {
            return res.status(404).json({ success: false, message: err.message });
        }
        if (err.message.includes('not authorized')) {
            return res.status(403).json({ success: false, message: err.message });
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to update order status.',
            error: err.message
        });
    }
};


module.exports = {
    createOrder,
    getOrderDetails,
    getTopSellingProducts,
    getSellerOrders,
    updateOrderStatus
};