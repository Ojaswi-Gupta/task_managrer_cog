const express = require('express');
const { getLeaderboard, getAdminStats } = require('../controllers/analyticsController');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/leaderboard/:quizId', authenticate, getLeaderboard);
router.get('/admin-stats', authenticate, requireAdmin, getAdminStats);

module.exports = router;
