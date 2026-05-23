// A fast, deterministic 32-bit PRNG (Mulberry32)
function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

// Fisher-Yates array shuffling using deterministic random generator
function seededShuffle(array, seed) {
  const rand = mulberry32(seed);
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Shuffles questions order and their option mapping deterministically based on attemptId.
 * @param {Array} questions - Array of questions
 * @param {number} attemptId - Active quiz attempt ID used as seed
 */
function shuffleQuestionsAndOptions(questions, attemptId) {
  if (!attemptId) return questions;

  // 1. Shuffle the order of questions using attemptId
  const shuffledQuestions = seededShuffle(questions, attemptId);

  // 2. For each question, shuffle option mapping (A, B, C, D) using (attemptId + question.id)
  return shuffledQuestions.map(q => {
    const questionSeed = attemptId + q.id;
    const originalKeys = ['A', 'B', 'C', 'D'];
    const shuffledKeys = seededShuffle(originalKeys, questionSeed);

    // Map new values (A -> value of shuffledKey[0], B -> value of shuffledKey[1], etc.)
    return {
      ...q,
      optionA: q[`option${shuffledKeys[0]}`],
      optionB: q[`option${shuffledKeys[1]}`],
      optionC: q[`option${shuffledKeys[2]}`],
      optionD: q[`option${shuffledKeys[3]}`]
    };
  });
}

/**
 * Translates a student's selection (A, B, C, D or comma-separated for MCQs) 
 * shown under shuffled keys back to original database keys.
 * @param {string} studentSelection - e.g. "C" or "A,D" or null
 * @param {number} attemptId - Attempt ID seed
 * @param {number} questionId - Question ID
 */
function translateOptionFromStudent(studentSelection, attemptId, questionId) {
  if (!studentSelection || !attemptId) return studentSelection;

  const questionSeed = attemptId + questionId;
  const originalKeys = ['A', 'B', 'C', 'D'];
  const shuffledKeys = seededShuffle(originalKeys, questionSeed);

  // Example: shuffledKeys = ['B', 'D', 'A', 'C']
  // If student clicked 'A', they saw original value of shuffledKeys[0] ('B').
  // So 'A' maps back to shuffledKeys[0] ('B').
  // If student clicked 'C', they saw original value of shuffledKeys[2] ('A').
  // So 'C' maps back to shuffledKeys[2] ('A').

  const mapLetter = (ch) => {
    const cleanCh = ch.trim().toUpperCase();
    const index = originalKeys.indexOf(cleanCh);
    if (index === -1) return cleanCh; // fallback
    return shuffledKeys[index];
  };

  if (studentSelection.includes(',')) {
    return studentSelection
      .split(',')
      .map(mapLetter)
      .sort()
      .join(',');
  }

  return mapLetter(studentSelection);
}

module.exports = {
  shuffleQuestionsAndOptions,
  translateOptionFromStudent
};
