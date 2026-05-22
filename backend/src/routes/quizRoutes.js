const express = require('express');
const {
  createQuiz,
  getQuizzes,
  getQuizById,
  updateQuiz,
  deleteQuiz,
  addQuestionToQuiz,
  getQuizQuestions,
  getQuizQuestionsForStudent,
  deleteQuestion
} = require('../controllers/quizController');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', authenticate, getQuizzes);
router.get('/:id', authenticate, getQuizById);
router.post('/', authenticate, requireAdmin, createQuiz);
router.put('/:id', authenticate, requireAdmin, updateQuiz);
router.delete('/:id', authenticate, requireAdmin, deleteQuiz);

router.post('/:id/questions', authenticate, requireAdmin, addQuestionToQuiz);
router.get('/:id/questions', authenticate, requireAdmin, getQuizQuestions);
router.get('/:id/exam-questions', authenticate, getQuizQuestionsForStudent);
router.delete('/questions/:questionId', authenticate, requireAdmin, deleteQuestion);

module.exports = router;
