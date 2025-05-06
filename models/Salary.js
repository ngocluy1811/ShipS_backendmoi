const mongoose = require('mongoose');

const salarySchema = new mongoose.Schema({
  salary_id: { type: String, required: true, unique: true },
  user_id: { type: String, required: true },
  date: { type: Date, required: true },
  total_salary: { type: Number, required: true },
});

module.exports = mongoose.model('Salary', salarySchema);