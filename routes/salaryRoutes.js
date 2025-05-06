const express = require('express');
const router = express.Router();
const Salary = require('../models/Salary');

router.post('/', async (req, res) => {
  try {
    const { user_id, date, total_salary } = req.body;
    if (!user_id || !date || !total_salary) {
      return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ user_id, date và total_salary.' });
    }
    const salary = new Salary({
      salary_id: `salary_${Date.now()}`,
      user_id,
      date,
      total_salary
    });
    await salary.save();
    res.json({ message: 'Tạo bản ghi lương thành công.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;