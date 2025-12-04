import express from 'express';
import {
  getCurrentUser,
  login,
  logout,
  register,
} from '../controllers/authController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
const router = express.Router();

router.post('/register', register);
router.post('login', login);
router.get('/me', requireAuth, getCurrentUser);
router.post('/logout', requireAuth, logout);
router.get('/check', requireAuth, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Token is valid',
    user: req.user,
  });
});

export default router;
