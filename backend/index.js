const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./src/routes/authRoutes');
const quizRoutes = require('./src/routes/quizRoutes');
const attemptRoutes = require('./src/routes/attemptRoutes');
const analyticsRoutes = require('./src/routes/analyticsRoutes');
const certificateRoutes = require('./src/routes/certificateRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const prisma = require('./src/prisma');

// Self-healing database synchronizer to dynamically keep totalMarks aligned with question marks sums
async function syncQuizzesTotalMarks() {
  try {
    const quizzes = await prisma.quiz.findMany({
      include: { questions: true }
    });
    for (const quiz of quizzes) {
      const actualTotalMarks = quiz.questions.reduce((sum, q) => sum + q.marks, 0);
      if (quiz.totalMarks !== actualTotalMarks) {
        await prisma.quiz.update({
          where: { id: quiz.id },
          data: { totalMarks: actualTotalMarks }
        });
        console.log(`[Sync] Corrected Quiz "${quiz.title}" (ID: ${quiz.id}) totalMarks from ${quiz.totalMarks} to ${actualTotalMarks}`);
      }
    }
  } catch (err) {
    console.warn('[Sync] Failed to sync total marks on startup:', err);
  }
}
syncQuizzesTotalMarks();

// Enable CORS
app.use(cors({
  origin: '*', // allows any frontend client connection, highly flexible for local/staging
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser with expanded limits for Base64 image uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Log requests during dev
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/attempts', attemptRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/certificates', certificateRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Central Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error: Something went wrong' });
});

// Boot Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
