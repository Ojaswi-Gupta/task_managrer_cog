import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BarChart2, Plus, Users, BookOpen, Activity, AlertTriangle, ShieldCheck, Trash2, LogOut, CheckCircle, HelpCircle, Eye, X, Calendar, ShieldAlert } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// Custom, premium glassmorphic tooltip for the analytics chart
const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div 
        className="glass-panel" 
        style={{ 
          padding: '14px 18px', 
          border: '1px solid var(--glass-border)', 
          fontSize: '12px', 
          boxShadow: '0 12px 30px -8px rgba(0,0,0,0.6)',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(10px)',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        <p style={{ fontWeight: '800', color: 'white', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '6px', margin: 0 }}>
          {data.title}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>Evaluations Count:</span>
            <strong style={{ color: 'white' }}>{data.attemptsCount}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px', alignItems: 'center' }}>
            <span style={{ color: '#c084fc', fontWeight: '500' }}>Pass Rate (%):</span>
            <strong style={{ color: '#d8b4fe' }}>{data.passRate.toFixed(1)}%</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px', alignItems: 'center' }}>
            <span style={{ color: '#818cf8', fontWeight: '500' }}>Average Score:</span>
            <strong style={{ color: '#a5b4fc' }}>{data.avgScore.toFixed(1)} / {data.totalMarks} pts</strong>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function AdminDashboard() {
  const { logout } = useAuth();

  const [stats, setStats] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [attemptsList, setAttemptsList] = useState([]);
  
  // Quiz creation form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('10');
  const [totalMarks, setTotalMarks] = useState('10');
  const [negativeMarks, setNegativeMarks] = useState('0.25');
  const [isPublished, setIsPublished] = useState(false);

  // Question creation form state
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [questionsList, setQuestionsList] = useState([]); // Questions in the selected quiz
  const [questionText, setQuestionText] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');
  const [correctOption, setCorrectOption] = useState('A');
  const [questionMarks, setQuestionMarks] = useState('1');

  // Review attempts details modal state
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const [activeSubTab, setActiveSubTab] = useState('stats'); // 'stats' | 'quizzes' | 'questions'
  const [loading, setLoading] = useState(true);
  const [questionsLoading, setQuestionsLoading] = useState(false);

  useEffect(() => {
    fetchAdminData();
  }, []);

  // Fetch questions whenever the selected quiz changes in the Question Manager tab
  useEffect(() => {
    if (selectedQuizId) {
      fetchQuestions(selectedQuizId);
    } else {
      setQuestionsList([]);
    }
  }, [selectedQuizId]);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [statsRes, quizzesRes, attemptsRes] = await Promise.all([
        axios.get(`${API_URL}/analytics/admin-stats`),
        axios.get(`${API_URL}/quizzes`),
        axios.get(`${API_URL}/attempts`)
      ]);
      setStats(statsRes.data);
      setQuizzes(quizzesRes.data);
      setAttemptsList(attemptsRes.data);

      if (quizzesRes.data.length > 0 && !selectedQuizId) {
        setSelectedQuizId(quizzesRes.data[0].id.toString());
      }
    } catch (err) {
      console.error('Failed to load admin analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestions = async (quizId) => {
    try {
      setQuestionsLoading(true);
      const res = await axios.get(`${API_URL}/quizzes/${quizId}/questions`);
      setQuestionsList(res.data);
    } catch (err) {
      console.error('Failed to fetch questions:', err);
    } finally {
      setQuestionsLoading(false);
    }
  };

  const handleCreateQuiz = async (e) => {
    e.preventDefault();
    if (!title || !duration || !totalMarks) return;

    try {
      await axios.post(`${API_URL}/quizzes`, {
        title,
        description,
        duration: parseInt(duration),
        totalMarks: parseInt(totalMarks),
        negativeMarks: parseFloat(negativeMarks),
        isPublished
      });

      alert('Quiz created successfully!');
      setTitle('');
      setDescription('');
      setDuration('10');
      setTotalMarks('10');
      setNegativeMarks('0.25');
      setIsPublished(false);

      fetchAdminData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create quiz');
    }
  };

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    if (!selectedQuizId || !questionText || !optionA || !optionB || !optionC || !optionD || !correctOption) {
      alert('All question details are required.');
      return;
    }

    try {
      await axios.post(`${API_URL}/quizzes/${selectedQuizId}/questions`, {
        questionText,
        optionA,
        optionB,
        optionC,
        optionD,
        correctOption,
        marks: parseInt(questionMarks)
      });

      alert('Question added successfully!');
      setQuestionText('');
      setOptionA('');
      setOptionB('');
      setOptionC('');
      setOptionD('');
      setCorrectOption('A');
      setQuestionMarks('1');

      // Refresh question list
      fetchQuestions(selectedQuizId);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add question');
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this question?');
    if (!confirmDelete) return;

    try {
      await axios.delete(`${API_URL}/quizzes/questions/${questionId}`);
      alert('Question deleted.');
      fetchQuestions(selectedQuizId);
    } catch (err) {
      alert('Failed to delete question');
    }
  };

  const handleDeleteQuiz = async (quizId) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this quiz? All related student attempts and questions will be permanently deleted.');
    if (!confirmDelete) return;

    try {
      await axios.delete(`${API_URL}/quizzes/${quizId}`);
      alert('Quiz deleted.');
      fetchAdminData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete quiz');
    }
  };

  const handleTogglePublish = async (quiz) => {
    try {
      await axios.put(`${API_URL}/quizzes/${quiz.id}`, {
        isPublished: !quiz.isPublished
      });
      fetchAdminData();
    } catch (err) {
      alert('Failed to update quiz visibility.');
    }
  };

  const handleReviewAttempt = async (attemptId) => {
    try {
      const res = await axios.get(`${API_URL}/attempts/${attemptId}`);
      setSelectedAttempt(res.data);
      setShowReviewModal(true);
    } catch (err) {
      alert('Failed to fetch attempt details.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '60px' }}>
      
      {/* Header */}
      <header
        className="glass-panel"
        style={{
          margin: '24px',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderRadius: '12px'
        }}
      >
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800' }}>
            <span className="shimmer-text">QuizPortal Control Center</span>
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Welcome back, <strong style={{ color: 'white' }}>Administrator</strong> (Evaluation Management Systems)
          </p>
        </div>
        <button className="glass-btn glass-btn-secondary" style={{ padding: '8px 16px' }} onClick={logout}>
          <LogOut size={16} />
          <span>Log Out</span>
        </button>
      </header>

      {/* Control Tabs */}
      <div style={{ margin: '0 24px 24px 24px', display: 'flex', gap: '12px' }}>
        <button
          className={`glass-btn ${activeSubTab === 'stats' ? 'glass-btn-primary' : 'glass-btn-secondary'}`}
          onClick={() => setActiveSubTab('stats')}
        >
          <BarChart2 size={16} />
          <span>Portal Statistics & Audits</span>
        </button>
        <button
          className={`glass-btn ${activeSubTab === 'quizzes' ? 'glass-btn-primary' : 'glass-btn-secondary'}`}
          onClick={() => setActiveSubTab('quizzes')}
        >
          <Plus size={16} />
          <span>Create Quizzes</span>
        </button>
        <button
          className={`glass-btn ${activeSubTab === 'questions' ? 'glass-btn-primary' : 'glass-btn-secondary'}`}
          onClick={() => setActiveSubTab('questions')}
        >
          <HelpCircle size={16} />
          <span>Question Bank Manager</span>
        </button>
      </div>

      <main style={{ padding: '0 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '80px', color: 'var(--text-secondary)' }}>Compiling aggregate analytics...</div>
        ) : (
          <div>
            {/* 1. PORTAL STATISTICS & AUDITS VIEW */}
            {activeSubTab === 'stats' && stats && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Score Counter Summary Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                  <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-primary)' }}>
                      <Users size={24} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>TOTAL STUDENTS</h4>
                      <h2 style={{ fontSize: '28px', fontWeight: '800' }}>{stats.summary.totalUsers}</h2>
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(168, 85, 247, 0.15)', color: 'var(--accent-secondary)' }}>
                      <BookOpen size={24} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>TOTAL EXAMS</h4>
                      <h2 style={{ fontSize: '28px', fontWeight: '800' }}>{stats.summary.totalQuizzes}</h2>
                    </div>
                  </div>

                  <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-success)' }}>
                      <Activity size={24} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>TOTAL EVALUATIONS</h4>
                      <h2 style={{ fontSize: '28px', fontWeight: '800' }}>{stats.summary.totalAttempts}</h2>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                  
                  {/* Recharts Analytics Panel */}
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>Evaluation Performance Metrics</h3>
                    {stats.quizPerformance.length === 0 ? (
                      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>No statistics recorded.</div>
                    ) : (
                      <div style={{ width: '100%', height: '320px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={stats.quizPerformance} margin={{ top: 10, right: -5, left: -25, bottom: 0 }}>
                            <defs>
                              <linearGradient id="passRateBarGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#a855f7" stopOpacity={0.4} />
                                <stop offset="100%" stopColor="#a855f7" stopOpacity={0.05} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis dataKey="title" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis yAxisId="left" stroke="#c084fc" fontSize={11} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
                            <YAxis yAxisId="right" orientation="right" stroke="#818cf8" fontSize={11} tickLine={false} axisLine={false} unit=" pts" />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                            <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', paddingBottom: '10px' }} />
                            <Bar yAxisId="left" dataKey="passRate" fill="url(#passRateBarGrad)" stroke="#a855f7" strokeWidth={1} radius={[6, 6, 0, 0]} name="Pass Rate (%)" barSize={36} />
                            <Line yAxisId="right" type="monotone" dataKey="avgScore" stroke="#6366f1" strokeWidth={3} dot={{ r: 5, stroke: '#6366f1', strokeWidth: 2, fill: '#111827' }} activeDot={{ r: 7, stroke: '#818cf8', strokeWidth: 2, fill: '#6366f1' }} name="Average Score (Points)" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {/* Hardest Questions Audit */}
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>Hardest Questions Audit</h3>
                    {stats.hardestQuestions.length === 0 ? (
                      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                        All queries completed with zero failure reports.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {stats.hardestQuestions.map((q, idx) => (
                          <div
                            key={q.questionId}
                            style={{
                              padding: '12px',
                              background: 'rgba(239, 68, 68, 0.03)',
                              border: '1px solid rgba(239, 68, 68, 0.15)',
                              borderRadius: '8px',
                              fontSize: '12px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontWeight: '700', color: 'var(--accent-danger)' }}>
                              <span>#{idx + 1} Hardest</span>
                              <span>{q.failures} Failed Attempts</span>
                            </div>
                            <p style={{ fontWeight: '600', marginBottom: '4px', color: 'var(--text-primary)' }}>"{q.text}"</p>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Quiz: {q.quizTitle}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

                {/* 📝 NEW: STUDENT ATTEMPTS AUDIT LIST */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>Student Exam Attempts Auditing Feed</h3>
                  {attemptsList.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No student submissions recorded in the database yet.
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
                          <th style={{ padding: '12px 8px', fontSize: '13px', color: 'var(--text-secondary)' }}>STUDENT</th>
                          <th style={{ padding: '12px 8px', fontSize: '13px', color: 'var(--text-secondary)' }}>ASSESSMENT</th>
                          <th style={{ padding: '12px 8px', fontSize: '13px', color: 'var(--text-secondary)' }}>DATE COMPLETED</th>
                          <th style={{ padding: '12px 8px', fontSize: '13px', color: 'var(--text-secondary)' }}>SCORE</th>
                          <th style={{ padding: '12px 8px', fontSize: '13px', color: 'var(--text-secondary)' }}>VIOLATIONS</th>
                          <th style={{ padding: '12px 8px', fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'right' }}>AUDIT ACTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attemptsList.map((att) => {
                          const pct = (att.score / att.quiz.totalMarks) * 100;
                          return (
                            <tr key={att.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <td style={{ padding: '16px 8px' }}>
                                <div style={{ fontWeight: '600' }}>{att.user.name}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{att.user.email}</div>
                              </td>
                              <td style={{ padding: '16px 8px', fontWeight: '600' }}>{att.quiz.title}</td>
                              <td style={{ padding: '16px 8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <Calendar size={14} />
                                  <span>{new Date(att.startTime).toLocaleDateString()}</span>
                                </div>
                              </td>
                              <td style={{ padding: '16px 8px' }}>
                                <span style={{ fontWeight: '800', color: pct >= 60 ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                                  {att.score.toFixed(1)}
                                </span>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/ {att.quiz.totalMarks} ({pct.toFixed(0)}%)</span>
                              </td>
                              <td style={{ padding: '16px 8px' }}>
                                <span style={{ color: att.cheatingStrikes > 0 ? 'var(--accent-danger)' : 'var(--text-muted)', fontWeight: '600' }}>
                                  {att.cheatingStrikes} strike{att.cheatingStrikes !== 1 && 's'}
                                </span>
                              </td>
                              <td style={{ padding: '16px 8px', textAlign: 'right' }}>
                                <button
                                  className="glass-btn glass-btn-secondary"
                                  style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)', background: 'rgba(99, 102, 241, 0.04)' }}
                                  onClick={() => handleReviewAttempt(att.id)}
                                >
                                  <Eye size={12} />
                                  <span>Review Answers</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

              </div>
            )}

            {/* 2. CREATE QUIZZES BOARD */}
            {activeSubTab === 'quizzes' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
                {/* Quiz Creator Form */}
                <form className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', alignSelf: 'start' }} onSubmit={handleCreateQuiz}>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Create New Assessment</h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Quiz Title</label>
                    <input type="text" placeholder="Java Basics Evaluation" className="glass-input" required value={title} onChange={e => setTitle(e.target.value)} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Description</label>
                    <textarea rows="3" placeholder="Enter evaluation syllabus summary details..." className="glass-input" value={description} onChange={e => setDescription(e.target.value)} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Duration (Mins)</label>
                      <input type="number" min="1" className="glass-input" required value={duration} onChange={e => setDuration(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Total Marks</label>
                      <input type="number" min="1" className="glass-input" required value={totalMarks} onChange={e => setTotalMarks(e.target.value)} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Negative Marking Deduction</label>
                    <input type="number" step="0.05" min="0" className="glass-input" required value={negativeMarks} onChange={e => setNegativeMarks(e.target.value)} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <input type="checkbox" id="publish-chk" style={{ cursor: 'pointer' }} checked={isPublished} onChange={e => setIsPublished(e.target.checked)} />
                    <label htmlFor="publish-chk" style={{ fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>Publish Immediately</label>
                  </div>

                  <button type="submit" className="glass-btn glass-btn-primary" style={{ marginTop: '10px' }}>
                    <Plus size={16} />
                    <span>Create Quiz</span>
                  </button>
                </form>

                {/* Quizzes List & Publishers */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>Manage Assessments</h3>
                  {quizzes.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>No quizzes created yet. Use the form to make one.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.08)' }}>
                          <th style={{ padding: '12px 8px', fontSize: '13px', color: 'var(--text-secondary)' }}>TITLE</th>
                          <th style={{ padding: '12px 8px', fontSize: '13px', color: 'var(--text-secondary)' }}>DURATION</th>
                          <th style={{ padding: '12px 8px', fontSize: '13px', color: 'var(--text-secondary)' }}>MARKS</th>
                          <th style={{ padding: '12px 8px', fontSize: '13px', color: 'var(--text-secondary)' }}>VISIBILITY</th>
                          <th style={{ padding: '12px 8px', fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'right' }}>ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quizzes.map((quiz) => (
                          <tr key={quiz.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '16px 8px', fontWeight: '600' }}>{quiz.title}</td>
                            <td style={{ padding: '16px 8px', fontSize: '13px' }}>{quiz.duration} mins</td>
                            <td style={{ padding: '16px 8px', fontSize: '13px' }}>
                              {quiz.totalMarks} Marks {quiz.negativeMarks > 0 && <span style={{ color: 'var(--accent-warning)', fontSize: '11px' }}>(-{quiz.negativeMarks})</span>}
                            </td>
                            <td style={{ padding: '16px 8px' }}>
                              <button
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  outline: 'none',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  background: quiz.isPublished ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                  color: quiz.isPublished ? 'var(--accent-success)' : 'var(--accent-danger)'
                                }}
                                onClick={() => handleTogglePublish(quiz)}
                              >
                                {quiz.isPublished ? 'PUBLISHED' : 'DRAFT'}
                              </button>
                            </td>
                            <td style={{ padding: '16px 8px', textAlign: 'right' }}>
                              <button
                                className="glass-btn glass-btn-secondary"
                                style={{ padding: '6px', borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.02)' }}
                                onClick={() => handleDeleteQuiz(quiz.id)}
                              >
                                <Trash2 size={14} style={{ color: 'var(--accent-danger)' }} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* 3. QUESTION MANAGER & BANK */}
            {activeSubTab === 'questions' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '24px' }}>
                
                {/* Question Creator Form */}
                <form className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', alignSelf: 'start' }} onSubmit={handleAddQuestion}>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '8px' }}>Add New MCQ</h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Target Quiz Board</label>
                    <select
                      className="glass-input"
                      required
                      value={selectedQuizId}
                      onChange={e => setSelectedQuizId(e.target.value)}
                    >
                      <option value="" disabled>-- Select Assessment --</option>
                      {quizzes.map(q => (
                        <option key={q.id} value={q.id}>{q.title}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Question Text</label>
                    <input type="text" placeholder="e.g. Which keyword declares a block-scope variable?" className="glass-input" required value={questionText} onChange={e => setQuestionText(e.target.value)} />
                  </div>

                  {/* MCQ Options */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-secondary)' }}>Option A</label>
                      <input type="text" placeholder="A" className="glass-input" style={{ padding: '8px 12px' }} required value={optionA} onChange={e => setOptionA(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-secondary)' }}>Option B</label>
                      <input type="text" placeholder="B" className="glass-input" style={{ padding: '8px 12px' }} required value={optionB} onChange={e => setOptionB(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-secondary)' }}>Option C</label>
                      <input type="text" placeholder="C" className="glass-input" style={{ padding: '8px 12px' }} required value={optionC} onChange={e => setOptionC(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-secondary)' }}>Option D</label>
                      <input type="text" placeholder="D" className="glass-input" style={{ padding: '8px 12px' }} required value={optionD} onChange={e => setOptionD(e.target.value)} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Correct Option Key</label>
                      <select className="glass-input" required value={correctOption} onChange={e => setCorrectOption(e.target.value)}>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="D">D</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Marks Value</label>
                      <input type="number" min="1" className="glass-input" required value={questionMarks} onChange={e => setQuestionMarks(e.target.value)} />
                    </div>
                  </div>

                  <button type="submit" className="glass-btn glass-btn-primary" style={{ marginTop: '8px' }}>
                    <Plus size={16} />
                    <span>Save MCQ</span>
                  </button>
                </form>

                {/* 📝 NEW: QUESTIONS BANK VIEW */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>Active Question Bank</h3>
                  
                  {!selectedQuizId ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      Select a quiz on the left to load its question bank.
                    </div>
                  ) : questionsLoading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      Loading question bank...
                    </div>
                  ) : questionsList.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No questions added to this quiz yet. Use the form to write one.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '550px', overflowY: 'auto', paddingRight: '8px' }}>
                      {questionsList.map((q, idx) => (
                        <div
                          key={q.id}
                          style={{
                            padding: '16px',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '10px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-primary)' }}>
                              Question {idx + 1} ({q.marks} Mark{q.marks !== 1 && 's'})
                            </span>
                            <button
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-danger)' }}
                              onClick={() => handleDeleteQuestion(q.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          
                          <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', lineHeight: '1.4' }}>
                            {q.questionText}
                          </p>

                          {/* Options grid with green highlight for correctOption */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                            {['A', 'B', 'C', 'D'].map(key => {
                              const isCorrect = q.correctOption.toUpperCase() === key;
                              return (
                                <div
                                  key={key}
                                  style={{
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    background: isCorrect ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255,255,255,0.01)',
                                    border: `1px solid ${isCorrect ? 'rgba(16, 185, 129, 0.3)' : 'var(--glass-border)'}`,
                                    color: isCorrect ? 'var(--accent-success)' : 'var(--text-secondary)',
                                    fontWeight: isCorrect ? '600' : '400'
                                  }}
                                >
                                  <strong>{key}:</strong> {q[`option${key}`]}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        )}
      </main>

      {/* 🛡️ NEW: INTERACTIVE STUDENT ATTEMPT REVIEW MODAL */}
      {showReviewModal && selectedAttempt && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '680px',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '32px',
              position: 'relative'
            }}
          >
            {/* Close Button */}
            <button
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
              onClick={() => setShowReviewModal(false)}
            >
              <X size={24} />
            </button>

            {/* Modal Header */}
            <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: 'var(--accent-primary)',
                  marginBottom: '8px',
                  display: 'inline-block'
                }}
              >
                SUBMISSION AUDIT REPORT
              </span>
              <h2 style={{ fontSize: '22px', fontWeight: '800', marginTop: '4px' }}>
                {selectedAttempt.quiz.title}
              </h2>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                <div>Student: <strong style={{ color: 'white' }}>{selectedAttempt.user?.name}</strong></div>
                <div>Score: <strong style={{ color: 'white' }}>{selectedAttempt.score.toFixed(1)} / {selectedAttempt.quiz.totalMarks}</strong></div>
                {selectedAttempt.cheatingStrikes > 0 && (
                  <div style={{ color: 'var(--accent-danger)', fontWeight: '700' }}>Strikes: {selectedAttempt.cheatingStrikes}</div>
                )}
              </div>
            </div>

            {/* Answers List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {selectedAttempt.answers.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>
                  No answered captured for this attempt (student might have submitted with an empty sheet).
                </div>
              ) : (
                selectedAttempt.answers.map((ans, idx) => {
                  const qText = ans.question.questionText;
                  const studentChoice = ans.selectedOption;
                  const correctChoice = ans.question.correctOption;
                  const isCorrect = ans.isCorrect;

                  return (
                    <div
                      key={ans.id}
                      style={{
                        padding: '16px',
                        background: 'rgba(255,255,255,0.01)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                          Question {idx + 1}
                        </span>
                        
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: isCorrect ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: isCorrect ? 'var(--accent-success)' : 'var(--accent-danger)'
                          }}
                        >
                          {isCorrect ? 'Correct (+1)' : studentChoice === null ? 'Skipped (0)' : 'Incorrect (Neg Deducted)'}
                        </span>
                      </div>

                      <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', lineHeight: '1.4' }}>
                        {qText}
                      </p>

                      <div style={{ display: 'flex', gap: '24px', fontSize: '13px' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Student Selection: </span>
                          <strong style={{ color: studentChoice ? (isCorrect ? 'var(--accent-success)' : 'var(--accent-danger)') : 'var(--text-muted)' }}>
                            {studentChoice ? `${studentChoice}: ${ans.question[`option${studentChoice}`]}` : '[Unanswered]'}
                          </strong>
                        </div>
                        
                        {!isCorrect && (
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Correct Answer: </span>
                            <strong style={{ color: 'var(--accent-success)' }}>
                              {correctChoice}: {ans.question[`option${correctChoice}`]}
                            </strong>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="glass-btn glass-btn-secondary"
                onClick={() => setShowReviewModal(false)}
              >
                Close Report
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
