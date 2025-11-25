const pool = require('../config/database');
const sql = require('mssql');

/**
 * Get all category names
 * Returns: [ "Category1", "Category2", ... ]
 */
async function getCategories() {
    const request = pool.request();
    const result = await request.query('SELECT Name FROM Category');
    return result.recordset.map(r => r.Name);
}

/**
 * Get products by seller.
 * Input: sellerId (string)
 * Returns: [
 *   {
 *     barcode,
 *     productName,
 *     price,       // price of top variation 
 *     image,  // first image URL if any
 *     avgRating
 *   }
 * ]
 */
async function getProductBySeller(sellerId) {
    const request = pool.request();
    request.input('sellerId', sql.VarChar(100), sellerId);

    const query = `
        SELECT 
            p.Bar_code AS barcode,
            p.Name AS productName,
            p.AvgRating,
            /* top variation price (lowest price). Change ORDER BY to pick different "top" logic */
            (SELECT TOP 1 v.PRICE FROM VARIATIONS v WHERE v.Bar_code = p.Bar_code) AS price,
            /* first image if exists */
            (SELECT TOP 1 i.IMAGE_URL FROM IMAGES i WHERE i.Bar_code = p.Bar_code) AS image
        FROM Product_SKU p
        WHERE p.sellerID = @sellerId
    `;

    const result = await request.query(query);
    return result.recordset;
}

/*
 * Get full product details by barcode.
 */
async function getProductDetails(barcode) {
    const request = pool.request();
    request.input('barcode', sql.VarChar(100), barcode);

    try {
        const result = await request.execute('sp_GetProductDetails');
        return result.recordsets;
    } catch (err) {
        // Error message
        throw new Error(`Stored procedure 'sp_GetProductDetails' failed. Original error: ${err.message}`);
    }
}

/*
 * Get all products
 */
async function getAllProduct() {
    const request = pool.request();

    const query = `
        SELECT 
            p.Bar_code AS barcode,
            p.Name AS productName,
            p.AvgRating,
            (SELECT TOP 1 v.PRICE FROM VARIATIONS v WHERE v.Bar_code = p.Bar_code ORDER BY v.PRICE ASC) AS price,
            (SELECT TOP 1 i.IMAGE_URL FROM IMAGES i WHERE i.Bar_code = p.Bar_code) AS image
        FROM Product_SKU p
    `;

    const result = await request.query(query);
    return result.recordset;
}

/**
 * Get products by name substring.
 * Input: name (string)
 */
async function getProductByName(name) {
    if (!name) return [];

    const request = pool.request();
    // include wildcards in parameter value to use parameterized LIKE safely
    request.input('name', sql.VarChar(100), `%${name}%`);

    const query = `
        SELECT 
            p.Bar_code AS barcode,
            p.Name AS productName,
            p.AvgRating,
            (SELECT TOP 1 v.PRICE FROM VARIATIONS v WHERE v.Bar_code = p.Bar_code ORDER BY v.PRICE ASC) AS price,
            (SELECT TOP 1 i.IMAGE_URL FROM IMAGES i WHERE i.Bar_code = p.Bar_code) AS image
        FROM Product_SKU p
        WHERE p.Name LIKE @name
    `;

    const result = await request.query(query);
    return result.recordset;
}

module.exports = {
    getCategories,
    getProductBySeller,
    getProductByName,
    getAllProduct,
    getProductDetails
};