const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const userController = require('../controllers/userController');

// Public routes
router.post('/register', userController.registerUser);
router.post('/verify-otp', userController.verifyUserOTP);
router.post('/resend-otp', userController.resendOTP);
router.post('/login', userController.loginUser);

// Protected routes
router.get('/me', userController.getUserInfo);
router.put('/me', userController.updateUserInfo);
router.put('/change-password', userController.changePassword);

router.post('/assign-warehouse', userController.assignShipperToWarehouse);

module.exports = router;