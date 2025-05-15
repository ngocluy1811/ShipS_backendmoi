const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Public routes
router.post('/register', userController.registerUser);
router.post('/verify-otp', userController.verifyUserOTP);
router.post('/resend-otp', userController.resendOTP);
router.post('/login', userController.loginUser);
// routes/user.routes.js hoặc tương tự
router.patch('/:id/verify', userController.verifyUser);
router.patch('/:id/unverify', userController.unverifyUser);
// Protected routes
router.get('/me', userController.getUserInfo);
router.put('/me', userController.updateUserInfo);
router.put('/change-password', userController.changePassword);

router.post('/assign-warehouse', userController.assignShipperToWarehouse);

// Quản trị user (admin/staff)
router.get('/', userController.listUsers); // GET /users?search=...&role=...&status=...&page=...
router.get('/:id', userController.getUserById); // GET /users/:id
router.put('/:id', userController.updateUserById); // PUT /users/:id
router.delete('/:id', userController.deleteUserById); // DELETE /users/:id
router.patch('/:id/active', userController.toggleUserActive); // PATCH /users/:id/active
router.get('/:id/activity', userController.getUserActivity);
router.patch('/:id/lock', userController.lockUser);
router.patch('/:id/unlock', userController.unlockUser);
module.exports = router;