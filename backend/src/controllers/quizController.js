const prisma = require('../prisma');

// --- Quiz CRUD Operations ---

const createQuiz = async (req, res) => {
  const { title, description, duration, totalMarks, negativeMarks, isPublished } = req.body;

  if (!title || !duration || totalMarks === undefined) {
    return res.status(400).json({ error: 'Title, duration (minutes), and totalMarks are required' });
  }

  try {
    const quiz = await prisma.quiz.create({
      data: {
        title,
        description,
        duration: parseInt(duration),
        totalMarks: parseInt(totalMarks),
        negativeMarks: negativeMarks ? parseFloat(negativeMarks) : 0.0,
        isPublished: !!isPublished
      }
    });

    res.status(201).json({ message: 'Quiz created successfully', quiz });
  } catch (err) {
    console.error('Create quiz error:', err);
    res.status(500).json({ error: 'Failed to create quiz' });
  }
};

const getQuizzes = async (req, res) => {
  try {
    const isStudent = req.user.role === 'STUDENT';
    
    // Students only see published quizzes, admins see all
    const quizzes = await prisma.quiz.findMany({
      where: isStudent ? { isPublished: true } : {},
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(quizzes);
  } catch (err) {
    console.error('Get quizzes error:', err);
    res.status(500).json({ error: 'Failed to retrieve quizzes' });
  }
};

const getQuizById = async (req, res) => {
  const { id } = req.params;

  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: parseInt(id) }
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (req.user.role === 'STUDENT' && !quiz.isPublished) {
      return res.status(403).json({ error: 'Access denied: Quiz is not published yet' });
    }

    res.status(200).json(quiz);
  } catch (err) {
    console.error('Get quiz by id error:', err);
    res.status(500).json({ error: 'Failed to retrieve quiz' });
  }
};

const updateQuiz = async (req, res) => {
  const { id } = req.params;
  const { title, description, duration, totalMarks, negativeMarks, isPublished } = req.body;

  try {
    const quiz = await prisma.quiz.update({
      where: { id: parseInt(id) },
      data: {
        title,
        description,
        duration: duration ? parseInt(duration) : undefined,
        totalMarks: totalMarks !== undefined ? parseInt(totalMarks) : undefined,
        negativeMarks: negativeMarks !== undefined ? parseFloat(negativeMarks) : undefined,
        isPublished: isPublished !== undefined ? !!isPublished : undefined
      }
    });

    res.status(200).json({ message: 'Quiz updated successfully', quiz });
  } catch (err) {
    console.error('Update quiz error:', err);
    res.status(500).json({ error: 'Failed to update quiz' });
  }
};

const deleteQuiz = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.quiz.delete({
      where: { id: parseInt(id) }
    });

    res.status(200).json({ message: 'Quiz deleted successfully' });
  } catch (err) {
    console.error('Delete quiz error:', err);
    res.status(500).json({ error: 'Failed to delete quiz' });
  }
};

// --- Question Management Operations ---

const addQuestionToQuiz = async (req, res) => {
  const { id } = req.params; // Quiz ID
  const { questionText, optionA, optionB, optionC, optionD, correctOption, questionType, marks } = req.body;

  if (!questionText || !optionA || !optionB || !optionC || !optionD || !correctOption) {
    return res.status(400).json({ error: 'Question text, all four options, and correctOption (A/B/C/D) are required' });
  }

  try {
    const quiz = await prisma.quiz.findUnique({ where: { id: parseInt(id) } });
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const question = await prisma.question.create({
      data: {
        quizId: parseInt(id),
        questionText,
        optionA,
        optionB,
        optionC,
        optionD,
        correctOption: correctOption.toUpperCase(),
        questionType: questionType || 'SINGLE',
        marks: marks ? parseInt(marks) : 1
      }
    });

    res.status(201).json({ message: 'Question added successfully', question });
  } catch (err) {
    console.error('Add question error:', err);
    res.status(500).json({ error: 'Failed to add question to quiz' });
  }
};

const getQuizQuestions = async (req, res) => {
  const { id } = req.params; // Quiz ID

  try {
    const questions = await prisma.question.findMany({
      where: { quizId: parseInt(id) }
    });

    res.status(200).json(questions);
  } catch (err) {
    console.error('Get questions admin error:', err);
    res.status(500).json({ error: 'Failed to retrieve questions' });
  }
};

const getQuizQuestionsForStudent = async (req, res) => {
  const { id } = req.params; // Quiz ID

  try {
    const quiz = await prisma.quiz.findUnique({ where: { id: parseInt(id) } });
    if (!quiz || !quiz.isPublished) {
      return res.status(404).json({ error: 'Quiz not found or not published' });
    }

    // Retrieve questions, but EXCLUDE correctOption so student cannot inspect payload
    const questions = await prisma.question.findMany({
      where: { quizId: parseInt(id) },
      select: {
        id: true,
        quizId: true,
        questionText: true,
        optionA: true,
        optionB: true,
        optionC: true,
        optionD: true,
        questionType: true,
        marks: true
      }
    });

    // Interview Booster: Dynamic Question/Option Shuffling (Optional request handler, simple shuffle here)
    const shuffledQuestions = questions.sort(() => Math.random() - 0.5);

    res.status(200).json(shuffledQuestions);
  } catch (err) {
    console.error('Get questions student error:', err);
    res.status(500).json({ error: 'Failed to retrieve exam questions' });
  }
};

const deleteQuestion = async (req, res) => {
  const { questionId } = req.params;

  try {
    await prisma.question.delete({
      where: { id: parseInt(questionId) }
    });

    res.status(200).json({ message: 'Question deleted successfully' });
  } catch (err) {
    console.error('Delete question error:', err);
    res.status(500).json({ error: 'Failed to delete question' });
  }
};

module.exports = {
  createQuiz,
  getQuizzes,
  getQuizById,
  updateQuiz,
  deleteQuiz,
  addQuestionToQuiz,
  getQuizQuestions,
  getQuizQuestionsForStudent,
  deleteQuestion
};
