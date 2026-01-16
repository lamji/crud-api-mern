const { bulkUploadProducts } = require('./bulkUploadProducts');
const { getAllProducts } = require('./getAllProducts');
const { getProductById } = require('./getProductById');
const { clearProductCache } = require('./clearProductCache');

// Re-export all product functions for use in routes
module.exports = {
  bulkUploadProducts,
  getAllProducts,
  getProductById,
  clearProductCache
};
