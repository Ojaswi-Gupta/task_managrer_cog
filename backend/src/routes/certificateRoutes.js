const express = require('express');
const { generateCertificate } = require('../controllers/certificateController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/:attemptId', authenticate, generateCertificate);

module.exports = router;
