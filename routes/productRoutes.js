const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// Lấy danh sách sản phẩm (công khai)
router.get('/', productController.getProducts);
// Thêm sản phẩm mới (yêu cầu admin)
router.post('/', productController.createProduct);

module.exports = router; 