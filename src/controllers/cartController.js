const cartModel = require('../models/Cart');
const getProductDetails = require('./productController')

//@desc   Get Cart Items
//@route  GET /api/cart/items
//@access Private
const getCartItems = async (req, res) => {
    try {
        const userId = req.user.Id;
        const cartId = await cartModel.getCartIdByUserId(userId);
        if (!cartId) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found for user'
            });
        }
        const items = await cartModel.getCartItems(cartId);
        res.status(200).json({
            success: true,
            items
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
}

//@desc  Add Variation to Cart
//@route POST /api/cart
//@access Private
const addVariationToCart = async (req, res) => {
    try {
        const userId = req.user.Id;
        const cartId = await cartModel.getCartIdByUserId(userId);
        if (!cartId) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found for user'
            });
        }
        const { barcode, variationName, quantity } = req.body;
        await cartModel.addVariationToCart(cartId, barcode, variationName, quantity);
        res.status(200).json({
            success: true,
            message: 'Variation added to cart'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
}

//@desc  Delete Cart Item
//@route DELETE /api/cart
//@access Private
const deleteCartItem = async (req, res) => {
    try {
        const userId = req.user.Id;
        const cartId = await cartModel.getCartIdByUserId(userId);
        if (!cartId) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found for user'
            });
        }
        const { barcode, variationName } = req.body;
        await cartModel.deleteCartItem(cartId, barcode, variationName);
        res.status(200).json({
            success: true,
            message: 'Cart item deleted'
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
}

module.exports = {
    getCartItems,
    addVariationToCart,
    deleteCartItem
};