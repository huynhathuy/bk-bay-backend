const productModel = require('../models/Product');
const userModel = require('../models/User');

// Normalize incoming payloads to the model's expected camelCase keys.
// This helps handle different client payload shapes (Name vs name, Manufacturing_date vs manufacturingDate, etc.)
function normalizeProductPayload(data) {
  if (!data || typeof data !== 'object') return {};
  const out = {};
  if (data.Name !== undefined) out.name = data.Name;
  if (data.name !== undefined) out.name = data.name;
  if (data.Description !== undefined) out.description = data.Description;
  if (data.description !== undefined) out.description = data.description;
  if (data.Manufacturing_date !== undefined) out.manufacturingDate = data.Manufacturing_date;
  if (data.manufacturingDate !== undefined) out.manufacturingDate = data.manufacturingDate;
  if (data.Expired_date !== undefined) out.expiredDate = data.Expired_date;
  if (data.expiredDate !== undefined) out.expiredDate = data.expiredDate;
  if (data.variations !== undefined) out.variations = data.variations;
  if (data.category !== undefined) out.category = data.category;
  if (data.Bar_code !== undefined) out.barCode = data.Bar_code;
  if (data.BarCode !== undefined) out.barCode = data.BarCode;
  if (data.barCode !== undefined) out.barCode = data.barCode;
  return out;
}

const listProducts = async (req, res) => {
  try {
    const sellerId = req.user?.Id;
    const role = await userModel.checkRole(sellerId);
    if (role !== 'seller' && role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { limit, offset, search, status, sortBy, order } = req.query;
    const result = await productModel.listProductsBySeller(sellerId, {
      limit: parseInt(limit, 10) || 20,
      offset: parseInt(offset, 10) || 0,
      search,
      status,
      sortBy,
      order,
    });

    res.status(200).json({ success: true, products: result });
  } catch (err) {
    console.error('sellerProductsController.listProducts error:', err);
    res.status(500).json({ success: false, message: 'Failed to list products', error: err.message });
  }
};

const getProduct = async (req, res) => {
  try {
    const sellerId = req.user?.Id;
    const role = await userModel.checkRole(sellerId);
    if (role !== 'seller' && role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const productId = req.params.id;
    const product = await productModel.getProductByBarcode(sellerId, productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.status(200).json({ success: true, product });
  } catch (err) {
    console.error('sellerProductsController.getProduct error:', err);
    res.status(500).json({ success: false, message: 'Failed to get product', error: err.message });
  }
};

const createProduct = async (req, res) => {
  try {
    const sellerId = req.user?.Id;
    const role = await userModel.checkRole(sellerId);
    if (role !== 'seller' && role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const data = req.body || {};

    // Basic validation: ensure required fields are present and well-formed
    const fieldErrors = {};
    if (!data.Name && !data.name) fieldErrors.name = 'Product name is required';
    if (data.variations && !Array.isArray(data.variations)) fieldErrors.variations = 'Variations must be an array';
    if (Array.isArray(data.variations)) {
      const vErrs = [];
      data.variations.forEach((v, i) => {
        const ve = {};
        if (!v) { vErrs[i] = { _error: 'Empty variant' }; return; }
        if (!(v.NAME || v.name)) ve.name = 'Variant name required';
        const price = v.PRICE !== undefined ? v.PRICE : v.price;
        if (price === undefined || price === null || isNaN(Number(price))) ve.price = 'Variant price must be a number';
        if (Object.keys(ve).length) vErrs[i] = ve;
      });
      if (vErrs.length && vErrs.some(Boolean)) fieldErrors.variations = vErrs;
    }

    if (data.category && typeof data.category !== 'string') fieldErrors.category = 'Category must be a string';
    if (Object.keys(fieldErrors).length) return res.status(400).json({ success: false, message: 'Validation failed', fieldErrors });

    const created = await productModel.createProduct(sellerId, data);
    res.status(201).json({ success: true, product: created });
  } catch (err) {
    console.error('sellerProductsController.createProduct error:', err);
    res.status(500).json({ success: false, message: 'Failed to create product', error: err.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const sellerId = req.user?.Id;
    const role = await userModel.checkRole(sellerId);
    if (role !== 'seller' && role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const productId = req.params.id;
    const incoming = req.body || {};
    // Normalize keys so model.updateProduct sees consistent field names
    const data = normalizeProductPayload(incoming);

    // Validate variants shape if present (do not allow invalid variants)
    if (data.variations && !Array.isArray(data.variations)) {
      return res.status(400).json({ success: false, message: 'Validation failed', fieldErrors: { variations: 'Variations must be an array' } });
    }

    const updated = await productModel.updateProduct(sellerId, productId, data);
    if (!updated) return res.status(404).json({ success: false, message: 'Product not found or not owned by seller' });
    res.status(200).json({ success: true, product: updated });
  } catch (err) {
    if (err.message && err.message.includes('CONFLICT')) {
      return res.status(409).json({ success: false, message: 'Version conflict', error: err.message });
    }
    console.error('sellerProductsController.updateProduct error:', err);
    res.status(500).json({ success: false, message: 'Failed to update product', error: err.message });
  }
};

const patchProduct = async (req, res) => {
  // For partial updates, reuse updateProduct logic
  return updateProduct(req, res);
};

const deleteProduct = async (req, res) => {
  try {
    const sellerId = req.user?.Id;
    const role = await userModel.checkRole(sellerId);
    if (role !== 'seller' && role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const productId = req.params.id;
    const deleted = await productModel.deleteProduct(sellerId, productId);
    if (!deleted) return res.status(404).json({ success: false, message: 'Product not found or not owned by seller' });
    res.status(200).json({ success: true, message: 'Product deleted' });
  } catch (err) {
    console.error('sellerProductsController.deleteProduct error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete product', error: err.message });
  }
};

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  patchProduct,
  deleteProduct,
};
