const Product = require('../models/Product');

// Lấy danh sách sản phẩm
exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find();
    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi lấy danh sách sản phẩm.' });
  }
};

// Thêm sản phẩm mới (dành cho admin)
exports.createProduct = async (req, res) => {
  try {
    const { name, price, image, description, category } = req.body;
    const product = new Product({ name, price, image, description, category });
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi khi thêm sản phẩm.' });
  }
}; 