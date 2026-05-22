const express = require('express');
const {
  startAttempt,
  submitAttempt,
  trackCheating,
  getAttempts,
  getAttemptDetails
} = require('../controllers/attemptController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/start', authenticate, startAttempt);
router.post('/submit', authenticate, submitAttempt);
router.post('/violation', authenticate, trackCheating);
router.get('/', authenticate, getAttempts);
router.get('/:id', authenticate, getAttemptDetails);

module.exports = router;
