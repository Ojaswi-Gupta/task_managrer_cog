import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AlertTriangle, Clock, ChevronLeft, ChevronRight, CheckCircle2, ShieldAlert } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export default function ExamPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // { questionId: selectedOption }
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [cheatingStrikes, setCheatingStrikes] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const countdownRef = useRef(null);

  // 1. Initial Load: Fetch Quiz and Questions, and Synchronize Attempt Timer
  useEffect(() => {
    const initializeExam = async () => {
      try {
        setLoading(true);
        // Find attempt details to grab Quiz ID
        const attemptRes = await axios.get(`${API_URL}/attempts/${attemptId}`);
        const attempt = attemptRes.data;

        if (attempt.status !== 'IN_PROGRESS') {
          alert('This quiz session is already completed.');
          navigate('/');
          return;
        }

        setQuiz(attempt.quiz);
        setCheatingStrikes(attempt.cheatingStrikes);

        // Fetch student-facing questions (EXCLUDES correctOption)
        const qRes = await axios.get(`${API_URL}/quizzes/${attempt.quizId}/exam-questions`);
        setQuestions(qRes.data);

        // Synchronize remaining time
        // Re-call the start endpoint to compute exact server-side drift
        const startRes = await axios.post(`${API_URL}/attempts/start`, { quizId: attempt.quizId });
        setRemainingSeconds(startRes.data.remainingSeconds);

        // Restore pre-saved answers if any (optional extension)
        const preSavedAnswers = {};
        attempt.answers?.forEach(ans => {
          if (ans.selectedOption) {
            preSavedAnswers[ans.questionId] = ans.selectedOption;
          }
        });
        setAnswers(preSavedAnswers);

      } catch (err) {
        console.error('Failed to initialize exam:', err);
        alert('Could not fetch quiz session.');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    initializeExam();
  }, [attemptId]);

  // 2. Resilient Timer Thread
  useEffect(() => {
    if (remainingSeconds === null || remainingSeconds <= 0) return;

    countdownRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          handleAutoSubmit(); // submit instantly
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownRef.current);
  }, [remainingSeconds]);

  // 3. PROCTORING: Tab Switching Visibility Listener (Interview Booster!)
  useEffect(() => {
    if (loading || submitting) return;

    const handleVisibilityChange = async () => {
      if (document.hidden) {
        try {
          const res = await axios.post(`${API_URL}/attempts/violation`, { attemptId });
          const updatedStrikes = res.data.cheatingStrikes;
          setCheatingStrikes(updatedStrikes);

          if (updatedStrikes >= 3) {
            alert('🚫 EXAM TERMINATED: You switched tabs 3 times. Your quiz has been locked and automatically submitted.');
            navigate('/');
          } else {
            alert(`⚠️ PROCTORING WARNING: Tab switch detected!\nStrikes: ${updatedStrikes}/3. The quiz will auto-submit on strike 3!`);
          }
        } catch (err) {
          console.error('Failed to record tab violation:', err);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loading, submitting, attemptId]);

  const handleSelectOption = (questionId, option) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: option
    }));
  };

  const handleAutoSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    alert('⏱️ TIME OUT: Your duration has expired. Submitting your quiz now.');

    try {
      const formattedAnswers = Object.entries(answers).map(([qid, val]) => ({
        questionId: parseInt(qid),
        selectedOption: val
      }));
      await axios.post(`${API_URL}/attempts/submit`, {
        attemptId: parseInt(attemptId),
        answers: formattedAnswers
      });
      navigate('/');
    } catch (err) {
      console.error(err);
      navigate('/');
    }
  };

  const handleManualSubmit = async () => {
    const confirmSubmit = window.confirm('Are you sure you want to finish and submit your quiz answers?');
    if (!confirmSubmit) return;

    setSubmitting(true);
    try {
      const formattedAnswers = Object.entries(answers).map(([qid, val]) => ({
        questionId: parseInt(qid),
        selectedOption: val
      }));

      const res = await axios.post(`${API_URL}/attempts/submit`, {
        attemptId: parseInt(attemptId),
        answers: formattedAnswers
      });

      alert(`Quiz evaluated! Your score: ${res.data.score.toFixed(1)}`);
      navigate('/');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit exam');
      setSubmitting(false);
    }
  };

  // Format seconds to mm:ss
  const formatTime = (secs) => {
    if (secs === null) return '00:00';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--text-secondary)' }}>
        Loading secure exam session...
      </div>
    );
  }

  const currentQuestion = questions[currentIdx];
  const isLastQuestion = currentIdx === questions.length - 1;

  return (
    <div style={{ minHeight: '100vh', padding: '24px' }}>
      
      {/* Dynamic Proctored Sub-Header */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          marginBottom: '24px',
          borderRadius: '12px',
          borderColor: cheatingStrikes > 0 ? 'rgba(239, 68, 68, 0.3)' : 'var(--glass-border)'
        }}
      >
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '700' }}>{quiz?.title}</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Strict Evaluation Mode. Do not minimize this browser or switch tabs.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          {/* Integrity Strikes Counter */}
          {cheatingStrikes > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: 'var(--accent-danger)',
                fontSize: '12px',
                fontWeight: '700'
              }}
            >
              <ShieldAlert size={16} />
              <span>{cheatingStrikes} / 3 Strikes</span>
            </div>
          )}

          {/* Countdown timer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              background: remainingSeconds < 60 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.15)',
              border: `1px solid ${remainingSeconds < 60 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`,
              color: remainingSeconds < 60 ? 'var(--accent-danger)' : 'var(--accent-primary)',
              fontFamily: 'monospace',
              fontSize: '18px',
              fontWeight: 'bold'
            }}
          >
            <Clock size={18} />
            <span>{formatTime(remainingSeconds)}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '24px' }}>
        
        {/* MCQ QUESTION WORKSPACE */}
        <div className="glass-panel" style={{ padding: '32px' }}>
          {questions.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No questions loaded for this quiz.</div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    color: 'var(--accent-primary)',
                    background: 'rgba(99, 102, 241, 0.12)',
                    padding: '4px 10px',
                    borderRadius: '6px'
                  }}
                >
                  Question {currentIdx + 1} of {questions.length}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Marks: <strong>{currentQuestion.marks}</strong>
                </span>
              </div>

              {/* Question Text */}
              <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '28px', lineHeight: '1.4' }}>
                {currentQuestion.questionText}
              </h3>

              {/* Options mapping */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '32px' }}>
                {['A', 'B', 'C', 'D'].map((opt) => {
                  const optText = currentQuestion[`option${opt}`];
                  const isSelected = answers[currentQuestion.id] === opt;
                  return (
                    <button
                      key={opt}
                      style={{
                        textAlign: 'left',
                        padding: '16px 20px',
                        borderRadius: '10px',
                        background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                        border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                        color: isSelected ? 'white' : 'var(--text-primary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        transition: 'all 0.2s',
                        outline: 'none'
                      }}
                      onClick={() => handleSelectOption(currentQuestion.id, opt)}
                    >
                      <span
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: isSelected ? 'var(--accent-primary)' : 'rgba(255,255,255,0.06)',
                          color: isSelected ? 'white' : 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '700',
                          fontSize: '13px'
                        }}
                      >
                        {opt}
                      </span>
                      <span style={{ fontSize: '15px' }}>{optText}</span>
                    </button>
                  );
                })}
              </div>

              {/* Pagination controls */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: '20px',
                  borderTop: '1px solid rgba(255,255,255,0.06)'
                }}
              >
                <button
                  className="glass-btn glass-btn-secondary"
                  disabled={currentIdx === 0}
                  onClick={() => setCurrentIdx(prev => prev - 1)}
                >
                  <ChevronLeft size={16} />
                  <span>Previous</span>
                </button>

                {isLastQuestion ? (
                  <button className="glass-btn glass-btn-primary" style={{ background: 'linear-gradient(135deg, var(--accent-success), #059669)' }} onClick={handleManualSubmit}>
                    <CheckCircle2 size={16} />
                    <span>Submit Quiz</span>
                  </button>
                ) : (
                  <button className="glass-btn glass-btn-secondary" onClick={() => setCurrentIdx(prev => prev + 1)}>
                    <span>Next</span>
                    <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* SIDEBAR NAVIGATION GRID */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', alignSelf: 'start' }}>
          <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)' }}>QUESTION SHEET</h4>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '10px'
            }}
          >
            {questions.map((q, idx) => {
              const isAnswered = !!answers[q.id];
              const isActive = idx === currentIdx;
              
              let bgColor = 'rgba(255, 255, 255, 0.02)';
              let borderColor = 'var(--glass-border)';
              let textColor = 'var(--text-secondary)';

              if (isAnswered) {
                bgColor = 'rgba(16, 185, 129, 0.15)';
                borderColor = 'rgba(16, 185, 129, 0.3)';
                textColor = 'var(--accent-success)';
              }

              if (isActive) {
                borderColor = 'var(--accent-primary)';
                bgColor = isAnswered ? 'rgba(16, 185, 129, 0.25)' : 'rgba(99, 102, 241, 0.15)';
                textColor = isAnswered ? 'white' : 'var(--accent-primary)';
              }

              return (
                <button
                  key={q.id}
                  style={{
                    aspectRatio: '1',
                    borderRadius: '8px',
                    background: bgColor,
                    border: `1px solid ${borderColor}`,
                    color: textColor,
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setCurrentIdx(idx)}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              lineHeight: '1.4',
              paddingTop: '16px',
              borderTop: '1px solid rgba(255,255,255,0.06)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)' }} />
              <span>Answered</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)' }} />
              <span>Unanswered</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
