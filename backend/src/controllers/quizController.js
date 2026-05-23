const prisma = require('../prisma');
const bcrypt = require('bcryptjs');
const { shuffleQuestionsAndOptions } = require('../utils/shuffler');

// --- Quiz CRUD Operations ---

const createQuiz = async (req, res) => {
  const { title, description, duration, totalMarks, negativeMarks, isPublished, cohortId, opensAt, closesAt } = req.body;

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
        isPublished: !!isPublished,
        cohortId: cohortId ? parseInt(cohortId) : null,
        opensAt: opensAt ? new Date(opensAt) : null,
        closesAt: closesAt ? new Date(closesAt) : null
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
    
    // Students only see published quizzes assigned to their cohort, admins see all
    const quizzes = await prisma.quiz.findMany({
      where: isStudent ? { isPublished: true, cohortId: req.user.cohortId } : {},
      include: { cohort: true },
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
      where: { id: parseInt(id) },
      include: { cohort: true }
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    if (req.user.role === 'STUDENT') {
      if (!quiz.isPublished) {
        return res.status(403).json({ error: 'Access denied: Quiz is not published yet' });
      }
      if (quiz.cohortId !== req.user.cohortId) {
        return res.status(403).json({ error: 'Access denied: You are not enrolled in the cohort assigned to this quiz' });
      }
    }

    res.status(200).json(quiz);
  } catch (err) {
    console.error('Get quiz by id error:', err);
    res.status(500).json({ error: 'Failed to retrieve quiz' });
  }
};

const updateQuiz = async (req, res) => {
  const { id } = req.params;
  const { title, description, duration, totalMarks, negativeMarks, isPublished, cohortId, opensAt, closesAt } = req.body;

  try {
    const quiz = await prisma.quiz.update({
      where: { id: parseInt(id) },
      data: {
        title,
        description,
        duration: duration ? parseInt(duration) : undefined,
        totalMarks: totalMarks !== undefined ? parseInt(totalMarks) : undefined,
        negativeMarks: negativeMarks !== undefined ? parseFloat(negativeMarks) : undefined,
        isPublished: isPublished !== undefined ? !!isPublished : undefined,
        cohortId: cohortId !== undefined ? (cohortId ? parseInt(cohortId) : null) : undefined,
        opensAt: opensAt !== undefined ? (opensAt ? new Date(opensAt) : null) : undefined,
        closesAt: closesAt !== undefined ? (closesAt ? new Date(closesAt) : null) : undefined
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
  const { questionText, optionA, optionB, optionC, optionD, correctOption, questionType, marks, questionImage } = req.body;

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
        marks: marks ? parseInt(marks) : 1,
        questionImage: questionImage || null
      }
    });

    // Dynamically recalculate and update totalMarks on the Quiz
    const allQuestions = await prisma.question.findMany({
      where: { quizId: parseInt(id) }
    });
    const totalMarks = allQuestions.reduce((sum, q) => sum + q.marks, 0);

    await prisma.quiz.update({
      where: { id: parseInt(id) },
      data: { totalMarks }
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
        marks: true,
        questionImage: true
      }
    });

    const attemptId = req.query.attemptId ? parseInt(req.query.attemptId) : null;

    // Algorithmic shuffling of question sequence and option choices deterministically based on attemptId
    const processedQuestions = attemptId 
      ? shuffleQuestionsAndOptions(questions, attemptId)
      : questions;

    res.status(200).json(processedQuestions);
  } catch (err) {
    console.error('Get questions student error:', err);
    res.status(500).json({ error: 'Failed to retrieve exam questions' });
  }
};

const deleteQuestion = async (req, res) => {
  const { questionId } = req.params;

  try {
    const question = await prisma.question.findUnique({
      where: { id: parseInt(questionId) }
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const quizId = question.quizId;

    await prisma.question.delete({
      where: { id: parseInt(questionId) }
    });

    // Dynamically recalculate and update totalMarks on the Quiz
    const allQuestions = await prisma.question.findMany({
      where: { quizId }
    });
    const totalMarks = allQuestions.reduce((sum, q) => sum + q.marks, 0);

    await prisma.quiz.update({
      where: { id: quizId },
      data: { totalMarks }
    });

    res.status(200).json({ message: 'Question deleted successfully' });
  } catch (err) {
    console.error('Delete question error:', err);
    res.status(500).json({ error: 'Failed to delete question' });
  }
};

const exportQuizGradesToCSV = async (req, res) => {
  const { id } = req.params; // Quiz ID

  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: parseInt(id) }
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const attempts = await prisma.attempt.findMany({
      where: { quizId: parseInt(id), status: { in: ['COMPLETED', 'FORCE_SUBMITTED'] } },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            cohort: true
          }
        }
      },
      orderBy: { score: 'desc' }
    });

    // Generate CSV contents with UTF-8 BOM for Microsoft Excel compliance
    let csv = '\uFEFF';
    csv += 'Student Name,Email Address,Assigned Cohort,Section,Status,Score Earned,Total Max Marks,Cheating Strikes,Date Attempted\n';

    attempts.forEach((att) => {
      const cohortName = att.user.cohort ? att.user.cohort.name : 'Unassigned';
      const cohortSection = att.user.cohort ? att.user.cohort.section : 'N/A';
      csv += `"${att.user.name}","${att.user.email}","${cohortName}","${cohortSection}","${att.status}",${att.score.toFixed(1)},${quiz.totalMarks},${att.cheatingStrikes},"${new Date(att.startTime).toLocaleString()}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="quiz_${id}_gradebook.csv"`);
    res.status(200).send(csv);
  } catch (err) {
    console.error('Export CSV grades error:', err);
    res.status(500).json({ error: 'Failed to compile and download gradebook CSV' });
  }
};

const getCohorts = async (req, res) => {
  try {
    const cohorts = await prisma.cohort.findMany({
      include: {
        students: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true
          }
        },
        quizzes: true
      },
      orderBy: { name: 'asc' }
    });
    res.status(200).json(cohorts);
  } catch (err) {
    console.error('Get cohorts error:', err);
    res.status(500).json({ error: 'Failed to retrieve cohorts' });
  }
};

const createCohort = async (req, res) => {
  const { name, section } = req.body;
  if (!name || !section) {
    return res.status(400).json({ error: 'Cohort name and section are required' });
  }
  try {
    const cohort = await prisma.cohort.create({
      data: { name, section }
    });
    res.status(201).json(cohort);
  } catch (err) {
    console.error('Create cohort error:', err);
    res.status(500).json({ error: 'Failed to create classroom section' });
  }
};

const createCohortStudent = async (req, res) => {
  const { name, email, password, cohortId } = req.body;
  if (!name || !email || !password || !cohortId) {
    return res.status(400).json({ error: 'All fields (name, email, password, target section) are required' });
  }
  try {
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    if (existingUser) {
      return res.status(400).json({ error: 'Email is already in use' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const student = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'STUDENT',
        cohortId: parseInt(cohortId)
      }
    });

    res.status(201).json({
      message: 'Student registered successfully',
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        cohortId: student.cohortId
      }
    });
  } catch (err) {
    console.error('Create cohort student error:', err);
    res.status(500).json({ error: 'Failed to register student' });
  }
};

const deleteCohort = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.cohort.delete({
      where: { id: parseInt(id) }
    });
    res.status(200).json({ message: 'Section deleted successfully' });
  } catch (err) {
    console.error('Delete cohort error:', err);
    res.status(500).json({ error: 'Failed to delete classroom section' });
  }
};

const deleteStudent = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.user.delete({
      where: { id: parseInt(id) }
    });
    res.status(200).json({ message: 'Student deleted successfully' });
  } catch (err) {
    console.error('Delete student error:', err);
    res.status(500).json({ error: 'Failed to delete student' });
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
  deleteQuestion,
  exportQuizGradesToCSV,
  getCohorts,
  createCohort,
  createCohortStudent,
  deleteCohort,
  deleteStudent
};
