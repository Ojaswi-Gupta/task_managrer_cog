const prisma = require('../prisma');
const { translateOptionFromStudent } = require('../utils/shuffler');

const startAttempt = async (req, res) => {
  const { quizId } = req.body;
  const userId = req.user.id;

  if (!quizId) {
    return res.status(400).json({ error: 'Quiz ID is required' });
  }

  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: parseInt(quizId) }
    });

    if (!quiz || !quiz.isPublished) {
      return res.status(404).json({ error: 'Quiz not found or not published' });
    }

    // Check if an attempt is already IN_PROGRESS for this user and quiz (Resilience!)
    const activeAttempt = await prisma.attempt.findFirst({
      where: {
        userId,
        quizId: parseInt(quizId),
        status: 'IN_PROGRESS'
      }
    });

    if (activeAttempt) {
      // Calculate remaining duration in seconds
      const elapsedMs = Date.now() - new Date(activeAttempt.startTime).getTime();
      const durationMs = quiz.duration * 60 * 1000;
      const remainingSeconds = Math.max(0, Math.floor((durationMs - elapsedMs) / 1000));

      if (remainingSeconds > 0) {
        return res.status(200).json({
          message: 'Active attempt resumed',
          attempt: activeAttempt,
          remainingSeconds
        });
      } else {
        // Auto-close past attempt if elapsed but wasn't submitted
        await prisma.attempt.update({
          where: { id: activeAttempt.id },
          data: { status: 'FORCE_SUBMITTED', endTime: new Date() }
        });
      }
    }

    // Create new attempt
    const newAttempt = await prisma.attempt.create({
      data: {
        userId,
        quizId: parseInt(quizId),
        status: 'IN_PROGRESS',
        startTime: new Date()
      }
    });

    res.status(201).json({
      message: 'Attempt started successfully',
      attempt: newAttempt,
      remainingSeconds: quiz.duration * 60
    });
  } catch (err) {
    console.error('Start attempt error:', err);
    res.status(500).json({ error: 'Failed to start quiz attempt' });
  }
};

const submitAttempt = async (req, res) => {
  const { attemptId, answers } = req.body; // answers: [{ questionId, selectedOption }]
  const userId = req.user.id;

  if (!attemptId || !Array.isArray(answers)) {
    return res.status(400).json({ error: 'Attempt ID and answers array are required' });
  }

  try {
    const attempt = await prisma.attempt.findUnique({
      where: { id: parseInt(attemptId) },
      include: { quiz: { include: { questions: true } } }
    });

    if (!attempt || attempt.userId !== userId) {
      return res.status(404).json({ error: 'Quiz attempt not found' });
    }

    if (attempt.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Attempt is already submitted or closed' });
    }

    // Server-Side Timer Validation
    const startTime = new Date(attempt.startTime).getTime();
    const durationMs = attempt.quiz.duration * 60 * 1000;
    const gracePeriodMs = 10000; // 10-second leeway buffer for latency
    const isOvertime = (Date.now() - startTime) > (durationMs + gracePeriodMs);

    let finalStatus = isOvertime ? 'FORCE_SUBMITTED' : 'COMPLETED';

    let totalScore = 0.0;
    const questions = attempt.quiz.questions;
    const answersMap = new Map(answers.map(a => [a.questionId, a.selectedOption]));

    const answersToCreate = [];

    for (const question of questions) {
      const selectedOptionShuffled = answersMap.get(question.id) || null;
      
      // Reverse-translate the selected option to map back to original database keys
      const selectedOption = selectedOptionShuffled 
        ? translateOptionFromStudent(selectedOptionShuffled, attempt.id, question.id) 
        : null;

      let isCorrect = false;
      let marksEarned = 0.0;

      if (selectedOption !== null) {
        if (selectedOption.toUpperCase() === question.correctOption.toUpperCase()) {
          isCorrect = true;
          marksEarned = question.marks;
        } else {
          // Negative marking deduction
          marksEarned = -attempt.quiz.negativeMarks;
        }
      }

      totalScore += marksEarned;

      answersToCreate.push({
        questionId: question.id,
        selectedOption: selectedOption ? selectedOption.toUpperCase() : null,
        isCorrect
      });
    }

    // Cap the lowest score at 0.0 to make it neat, or allow negative
    const finalScore = Math.max(0.0, totalScore);

    // Save individual answers and update the Attempt
    await prisma.$transaction(async (tx) => {
      // Delete any preexisting answer captures for this attempt (cleanup in case of dual posts)
      await tx.attemptAnswer.deleteMany({
        where: { attemptId: attempt.id }
      });

      // Create answers
      for (const ans of answersToCreate) {
        await tx.attemptAnswer.create({
          data: {
            attemptId: attempt.id,
            questionId: ans.questionId,
            selectedOption: ans.selectedOption,
            isCorrect: ans.isCorrect
          }
        });
      }

      // Update attempt score and metadata
      await tx.attempt.update({
        where: { id: attempt.id },
        data: {
          score: finalScore,
          status: finalStatus,
          endTime: new Date()
        }
      });
    });

    res.status(200).json({
      message: isOvertime ? 'Quiz auto-submitted due to timeout' : 'Quiz submitted successfully',
      score: finalScore,
      status: finalStatus
    });
  } catch (err) {
    console.error('Submit attempt error:', err);
    res.status(500).json({ error: 'Failed to submit quiz attempt' });
  }
};

const trackCheating = async (req, res) => {
  const { attemptId } = req.body;
  const userId = req.user.id;

  if (!attemptId) {
    return res.status(400).json({ error: 'Attempt ID is required' });
  }

  try {
    const attempt = await prisma.attempt.findUnique({
      where: { id: parseInt(attemptId) }
    });

    if (!attempt || attempt.userId !== userId) {
      return res.status(404).json({ error: 'Attempt record not found' });
    }

    if (attempt.status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Attempt is already finished' });
    }

    const updatedAttempt = await prisma.attempt.update({
      where: { id: attempt.id },
      data: {
        cheatingStrikes: attempt.cheatingStrikes + 1
      }
    });

    // Auto-lock / submit if strikes reach 5
    if (updatedAttempt.cheatingStrikes >= 5) {
      // Trigger forced submission
      // We will read preexisting selections (if any) and trigger a force submit
      const currentAnswers = await prisma.attemptAnswer.findMany({
        where: { attemptId: attempt.id }
      });

      const formattedAnswers = currentAnswers.map(ans => ({
        questionId: ans.questionId,
        selectedOption: ans.selectedOption
      }));

      // Mock request body to delegate to submitAttempt
      req.body = {
        attemptId: attempt.id,
        answers: formattedAnswers
      };

      // Force status update via submitAttempt
      return await submitAttempt(req, res);
    }

    res.status(200).json({
      message: 'Cheating violation recorded',
      cheatingStrikes: updatedAttempt.cheatingStrikes
    });
  } catch (err) {
    console.error('Track cheating error:', err);
    res.status(500).json({ error: 'Failed to report proctoring warning' });
  }
};

const getAttempts = async (req, res) => {
  try {
    const isStudent = req.user.role === 'STUDENT';
    const userId = req.user.id;

    const attempts = await prisma.attempt.findMany({
      where: isStudent ? { userId } : {},
      include: {
        quiz: { select: { title: true, duration: true, totalMarks: true } },
        user: { select: { name: true, email: true } }
      },
      orderBy: { startTime: 'desc' }
    });

    res.status(200).json(attempts);
  } catch (err) {
    console.error('Get attempts error:', err);
    res.status(500).json({ error: 'Failed to retrieve history' });
  }
};

const getAttemptDetails = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const attempt = await prisma.attempt.findUnique({
      where: { id: parseInt(id) },
      include: {
        quiz: {
          select: {
            title: true,
            duration: true,
            totalMarks: true,
            negativeMarks: true,
            questions: true
          }
        },
        answers: {
          include: { question: true }
        }
      }
    });

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    // Role Guard: Students can only view their own details
    if (req.user.role === 'STUDENT' && attempt.userId !== userId) {
      return res.status(403).json({ error: 'Access denied: Cannot view another student\'s attempt' });
    }

    res.status(200).json(attempt);
  } catch (err) {
    console.error('Get attempt details error:', err);
    res.status(500).json({ error: 'Failed to retrieve attempt details' });
  }
};

module.exports = {
  startAttempt,
  submitAttempt,
  trackCheating,
  getAttempts,
  getAttemptDetails
};
