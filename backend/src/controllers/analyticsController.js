const prisma = require('../prisma');

const getLeaderboard = async (req, res) => {
  const { quizId } = req.params;

  if (!quizId) {
    return res.status(400).json({ error: 'Quiz ID is required' });
  }

  try {
    const parsedQuizId = parseInt(quizId);

    // Grab all attempts for this quiz that are submitted
    const attempts = await prisma.attempt.findMany({
      where: {
        quizId: parsedQuizId,
        status: { in: ['COMPLETED', 'FORCE_SUBMITTED'] }
      },
      include: {
        user: { select: { name: true, email: true } }
      }
    });

    // Interview Booster SQL Grouping:
    // We group attempts by userId and grab the HIGHEST score for each user
    const userBestScores = {};
    for (const att of attempts) {
      const uid = att.userId;
      if (!userBestScores[uid] || userBestScores[uid].score < att.score) {
        userBestScores[uid] = {
          userId: uid,
          name: att.user.name,
          email: att.user.email,
          score: att.score,
          cheatingStrikes: att.cheatingStrikes,
          timeTakenSeconds: att.endTime 
            ? Math.floor((new Date(att.endTime).getTime() - new Date(att.startTime).getTime()) / 1000)
            : 0
        };
      }
    }

    // Convert map to array and sort descending by score, then ascending by time taken
    const leaderboard = Object.values(userBestScores).sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.timeTakenSeconds - b.timeTakenSeconds;
    });

    res.status(200).json(leaderboard);
  } catch (err) {
    console.error('Get leaderboard error:', err);
    res.status(500).json({ error: 'Failed to generate quiz leaderboard' });
  }
};

const getAdminStats = async (req, res) => {
  try {
    // Count stats
    const totalUsers = await prisma.user.count({ where: { role: 'STUDENT' } });
    const totalQuizzes = await prisma.quiz.count();
    const totalAttempts = await prisma.attempt.count({
      where: { status: { in: ['COMPLETED', 'FORCE_SUBMITTED'] } }
    });

    // Average scores per quiz
    const quizzes = await prisma.quiz.findMany({
      include: {
        attempts: {
          where: { status: { in: ['COMPLETED', 'FORCE_SUBMITTED'] } }
        }
      }
    });

    const quizPerformance = quizzes.map(q => {
      const attemptsCount = q.attempts.length;
      const totalScore = q.attempts.reduce((sum, att) => sum + att.score, 0);
      const avgScore = attemptsCount > 0 ? (totalScore / attemptsCount).toFixed(1) : 0;
      
      // Pass threshold: >= 60% of totalMarks
      const passThreshold = q.totalMarks * 0.6;
      const passedAttempts = q.attempts.filter(att => att.score >= passThreshold).length;
      const passRate = attemptsCount > 0 ? ((passedAttempts / attemptsCount) * 100).toFixed(1) : 0;

      return {
        id: q.id,
        title: q.title,
        attemptsCount,
        avgScore: parseFloat(avgScore),
        passRate: parseFloat(passRate),
        totalMarks: q.totalMarks
      };
    });

    // Hardest questions audit
    // Count how many times each question was answered incorrectly
    const wrongAnswers = await prisma.attemptAnswer.findMany({
      where: { isCorrect: false, selectedOption: { not: null } },
      include: { question: { select: { questionText: true, quiz: { select: { title: true } } } } }
    });

    const questionFailureCounts = {};
    for (const ans of wrongAnswers) {
      const qid = ans.questionId;
      if (!questionFailureCounts[qid]) {
        questionFailureCounts[qid] = {
          questionId: qid,
          text: ans.question.questionText,
          quizTitle: ans.question.quiz.title,
          failures: 0
        };
      }
      questionFailureCounts[qid].failures += 1;
    }

    const hardestQuestions = Object.values(questionFailureCounts)
      .sort((a, b) => b.failures - a.failures)
      .slice(0, 5); // top 5 hardest questions

    res.status(200).json({
      summary: {
        totalUsers,
        totalQuizzes,
        totalAttempts
      },
      quizPerformance,
      hardestQuestions
    });
  } catch (err) {
    console.error('Get admin stats error:', err);
    res.status(500).json({ error: 'Failed to compile analytical statistics' });
  }
};

module.exports = {
  getLeaderboard,
  getAdminStats
};
