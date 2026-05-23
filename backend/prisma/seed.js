const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Clean existing records to avoid duplicate keys
  await prisma.attemptAnswer.deleteMany({});
  await prisma.attempt.deleteMany({});
  await prisma.question.deleteMany({});
  await prisma.quiz.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.cohort.deleteMany({});

  // 2. Create encrypted passwords
  const salt = await bcrypt.genSalt(10);
  const studentPassword = await bcrypt.hash('student123', salt);
  const adminPassword = await bcrypt.hash('admin123', salt);

  // 3. Create Batch/Cohorts
  const cohortA = await prisma.cohort.create({
    data: {
      name: 'Computer Science',
      section: 'Section A'
    }
  });

  const cohortB = await prisma.cohort.create({
    data: {
      name: 'Electrical Engineering',
      section: 'Section B'
    }
  });

  console.log(`Created cohorts:\n- A: ${cohortA.name} (${cohortA.section})\n- B: ${cohortB.name} (${cohortB.section})`);

  // 4. Create mock Users
  const student = await prisma.user.create({
    data: {
      name: 'John Student',
      email: 'student@quizportal.com',
      password: studentPassword,
      role: 'STUDENT',
      cohortId: cohortA.id
    }
  });

  const studentB = await prisma.user.create({
    data: {
      name: 'Bob Student',
      email: 'student_b@quizportal.com',
      password: studentPassword,
      role: 'STUDENT',
      cohortId: cohortB.id
    }
  });

  const admin = await prisma.user.create({
    data: {
      name: 'Jane Admin',
      email: 'admin@quizportal.com',
      password: adminPassword,
      role: 'ADMIN'
    }
  });

  console.log(`Created users:\n- Student A: ${student.email}\n- Student B: ${studentB.email}\n- Admin: ${admin.email}`);

  // 5. Create Quiz 1: JavaScript Essentials (Assigned to Section A)
  const quiz1 = await prisma.quiz.create({
    data: {
      title: 'JavaScript Essentials Test',
      description: 'Test your understanding of core JS closures, event loop, and asynchronous behavior.',
      duration: 5, // 5 minutes
      totalMarks: 3,
      negativeMarks: 0.25,
      isPublished: true,
      cohortId: cohortA.id,
      opensAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      closesAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) // 7 days from now
    }
  });

  const q1_1 = await prisma.question.create({
    data: {
      quizId: quiz1.id,
      questionText: 'Which of the following is NOT a reserved word in JavaScript?',
      optionA: 'interface',
      optionB: 'program',
      optionC: 'throws',
      optionD: 'short',
      correctOption: 'B',
      marks: 1
    }
  });

  const q1_2 = await prisma.question.create({
    data: {
      quizId: quiz1.id,
      questionText: 'What is the output of "console.log(typeof NaN)"?',
      optionA: '"number"',
      optionB: '"NaN"',
      optionC: '"undefined"',
      optionD: '"object"',
      correctOption: 'A',
      marks: 1
    }
  });

  const q1_3 = await prisma.question.create({
    data: {
      quizId: quiz1.id,
      questionText: 'Which method is used to serialize a JavaScript object into a JSON string?',
      optionA: 'JSON.parse()',
      optionB: 'JSON.convert()',
      optionC: 'JSON.stringify()',
      optionD: 'JSON.serialize()',
      correctOption: 'C',
      marks: 1
    }
  });

  // 6. Create Quiz 2: React & 3D WebGL (Assigned to Section B)
  const quiz2 = await prisma.quiz.create({
    data: {
      title: 'React & 3D WebGL Basics',
      description: 'Evaluate your knowledge of component state, React Three Fiber (R3F), and WebGL rendering pipelines.',
      duration: 10, // 10 minutes
      totalMarks: 3,
      negativeMarks: 0.5,
      isPublished: true,
      cohortId: cohortB.id,
      opensAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      closesAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) // 7 days from now
    }
  });

  const q2_1 = await prisma.question.create({
    data: {
      quizId: quiz2.id,
      questionText: 'In React, what hook is primarily used to perform side effects in functional components?',
      optionA: 'useState',
      optionB: 'useReducer',
      optionC: 'useEffect',
      optionD: 'useCallback',
      correctOption: 'C',
      marks: 1
    }
  });

  const q2_2 = await prisma.question.create({
    data: {
      quizId: quiz2.id,
      questionText: 'Which library is standard for binding Three.js elements into the React component structure?',
      optionA: 'React Three Fiber (R3F)',
      optionB: 'ThreeReact',
      optionC: 'DreiWebGL',
      optionD: 'ReactShader',
      correctOption: 'A',
      marks: 1
    }
  });

  const q2_3 = await prisma.question.create({
    data: {
      quizId: quiz2.id,
      questionText: 'What is the standard component in React Three Fiber that acts as the entry point rendering canvas?',
      optionA: '<Viewport>',
      optionB: '<Canvas>',
      optionC: '<Scene3D>',
      optionD: '<WebGLRenderer>',
      correctOption: 'B',
      marks: 1
    }
  });

  // 7. Create a mock completed Attempt for Student A on Quiz 1
  const attempt = await prisma.attempt.create({
    data: {
      userId: student.id,
      quizId: quiz1.id,
      score: 1.75, // 2 correct (+2), 1 incorrect (-0.25) => 1.75
      cheatingStrikes: 1,
      status: 'COMPLETED',
      startTime: new Date(Date.now() - 1000 * 60 * 5), // 5 mins ago
      endTime: new Date(Date.now() - 1000 * 60 * 3) // 3 mins ago
    }
  });

  await prisma.attemptAnswer.createMany({
    data: [
      {
        attemptId: attempt.id,
        questionId: q1_1.id,
        selectedOption: 'B', // Correct
        isCorrect: true
      },
      {
        attemptId: attempt.id,
        questionId: q1_2.id,
        selectedOption: 'B', // Incorrect (Correct is A)
        isCorrect: false
      },
      {
        attemptId: attempt.id,
        questionId: q1_3.id,
        selectedOption: 'C', // Correct
        isCorrect: true
      }
    ]
  });

  console.log('Created mock completed attempt for student@quizportal.com');

  console.log('🎉 Seeding successfully completed!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
