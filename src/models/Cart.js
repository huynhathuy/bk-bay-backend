const pool = require('../config/database');
const sql = require('mssql');

const getCartIdByUserId = async (userId) => {
    const req = pool.request();
    req.input('UserID', sql.VarChar, userId);
    const result = await req.query('SELECT cartId FROM Buyer WHERE Id = @UserID');
    if (result.recordset && result.recordset[0]) {
        return result.recordset[0].cartId;
    }
    return null;
}

const getCartItems = async (cartId) => {
    const req = pool.request();
    req.input('CartID', sql.VarChar, cartId);
    const result = await req.execute('getCartItems');
    return result.recordset || [];
}

const addVariationToCart = async (cartId, barcode, variationName, quantity) => {
    const req = pool.request();
    req.input('CartID', sql.VarChar, cartId);
    req.input('BarCode', sql.VarChar, barcode);
    req.input('VariationName', sql.VarChar, variationName);
    req.input('Quantity', sql.Int, quantity);
    await req.execute('addVariationToCart');
}

const deleteCartItem = async (cartId, barcode, variationName) => {
    const req = pool.request();
    req.input('CartID', sql.VarChar, cartId);
    req.input('BarCode', sql.VarChar, barcode);
    req.input('VariationName', sql.VarChar, variationName);
    await req.execute('deleteCartItem');
}

module.exports = {
    getCartIdByUserId,
    getCartItems,
    addVariationToCart,
    deleteCartItem
};