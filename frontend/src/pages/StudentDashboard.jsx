import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Award, BookOpen, Clock, Calendar, CheckCircle2, ChevronRight, LogOut, Trophy, AlertTriangle, Download } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [quizzes, setQuizzes] = useState([]);
  const [history, setHistory] = useState([]);
  const [leaderboards, setLeaderboards] = useState([]);
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('quizzes'); // 'quizzes' | 'history' | 'leaderboards'

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [quizzesRes, historyRes] = await Promise.all([
        axios.get(`${API_URL}/quizzes`),
        axios.get(`${API_URL}/attempts`)
      ]);
      setQuizzes(quizzesRes.data);
      setHistory(historyRes.data);

      if (quizzesRes.data.length > 0) {
        setSelectedQuizId(quizzesRes.data[0].id.toString());
        fetchLeaderboard(quizzesRes.data[0].id);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboard = async (quizId) => {
    try {
      const res = await axios.get(`${API_URL}/analytics/leaderboard/${quizId}`);
      setLeaderboards(res.data);
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    }
  };

  const handleLeaderboardChange = (e) => {
    const qid = e.target.value;
    setSelectedQuizId(qid);
    if (qid) fetchLeaderboard(qid);
  };

  const handleStartExam = async (quizId) => {
    try {
      const res = await axios.post(`${API_URL}/attempts/start`, { quizId });
      // Redirect straight to exam page with attempt metadata
      navigate(`/exam/${res.data.attempt.id}`);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to initialize exam session');
    }
  };

  const handleDownloadCertificate = (attemptId) => {
    // Open in a new window using authenticated download
    const win = window.open(`${API_URL}/certificates/${attemptId}?token=${localStorage.getItem('token')}`, '_blank');
    // Note: Our certificate API takes Bearer token. 
    // To support clean standard links, we can also extract token from query parameters! 
    // Let's make sure we double-check our auth middleware to support query parameter tokens as a fallback.
    // Yes! That's a highly robust enhancement. Let's make sure we edit our backend auth middleware to extract token from query params too, so direct links work effortlessly!
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '60px' }}>
      {/* Dynamic Header */}
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
            <span className="shimmer-text">QuizPortal Hub</span>
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Welcome back, <strong style={{ color: 'white' }}>{user?.name}</strong> (Student Evaluation Console)
          </p>
        </div>
        <button className="glass-btn glass-btn-secondary" style={{ padding: '8px 16px' }} onClick={logout}>
          <LogOut size={16} />
          <span>Log Out</span>
        </button>
      </header>

      {/* Navigation tabs */}
      <div style={{ margin: '0 24px 24px 24px', display: 'flex', gap: '12px' }}>
        <button
          className={`glass-btn ${activeTab === 'quizzes' ? 'glass-btn-primary' : 'glass-btn-secondary'}`}
          onClick={() => setActiveTab('quizzes')}
        >
          <BookOpen size={16} />
          <span>Available Assessments</span>
        </button>
        <button
          className={`glass-btn ${activeTab === 'history' ? 'glass-btn-primary' : 'glass-btn-secondary'}`}
          onClick={() => setActiveTab('history')}
        >
          <Award size={16} />
          <span>Attempt History</span>
        </button>
        <button
          className={`glass-btn ${activeTab === 'leaderboards' ? 'glass-btn-primary' : 'glass-btn-secondary'}`}
          onClick={() => setActiveTab('leaderboards')}
        >
          <Trophy size={16} />
          <span>Rankings & Leaderboard</span>
        </button>
      </div>

      <main style={{ padding: '0 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '80px', color: 'var(--text-secondary)' }}>Loading portal metrics...</div>
        ) : (
          <div>
            {/* 1. QUIZ BOARD VIEW */}
            {activeTab === 'quizzes' && (
              <div>
                {quizzes.length === 0 ? (
                  <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No published quizzes available at this moment. Please check back later.
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                      gap: '24px'
                    }}
                  >
                    {quizzes.map((quiz) => (
                      <div key={quiz.id} className="glass-panel glass-panel-hover" style={{ padding: '24px', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: '700' }}>{quiz.title}</h3>
                          </div>
                          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.5' }}>
                            {quiz.description || 'No description provided.'}
                          </p>
                        </div>
                        
                        <div>
                          <div
                            style={{
                              display: 'flex',
                              gap: '16px',
                              fontSize: '12px',
                              color: 'var(--text-secondary)',
                              paddingTop: '16px',
                              borderTop: '1px solid rgba(255,255,255,0.06)',
                              marginBottom: '20px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={14} style={{ color: 'var(--accent-primary)' }} />
                              <span>{quiz.duration} mins</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Award size={14} style={{ color: 'var(--accent-secondary)' }} />
                              <span>{quiz.totalMarks} Marks</span>
                            </div>
                            {quiz.negativeMarks > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-warning)' }}>
                                <AlertTriangle size={14} />
                                <span>-{quiz.negativeMarks} Neg</span>
                              </div>
                            )}
                          </div>

                          <button
                            className="glass-btn glass-btn-primary"
                            style={{ width: '100%' }}
                            onClick={() => handleStartExam(quiz.id)}
                          >
                            <span>Start Evaluation</span>
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 2. HISTORY VIEW */}
            {activeTab === 'history' && (
              <div className="glass-panel" style={{ padding: '24px', overflowX: 'auto' }}>
                {history.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    You have not attempted any evaluation quizzes yet. Complete an exam to view history logs!
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
                        <th style={{ padding: '12px 8px', fontSize: '13px', color: 'var(--text-secondary)' }}>ASSESSMENT</th>
                        <th style={{ padding: '12px 8px', fontSize: '13px', color: 'var(--text-secondary)' }}>DATE SUBMITTED</th>
                        <th style={{ padding: '12px 8px', fontSize: '13px', color: 'var(--text-secondary)' }}>STATUS</th>
                        <th style={{ padding: '12px 8px', fontSize: '13px', color: 'var(--text-secondary)' }}>SCORE</th>
                        <th style={{ padding: '12px 8px', fontSize: '13px', color: 'var(--text-secondary)' }}>VIOLATIONS</th>
                        <th style={{ padding: '12px 8px', fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'right' }}>CERTIFICATE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((att) => {
                        const pct = (att.score / att.quiz.totalMarks) * 100;
                        const isPassed = pct >= 60;
                        return (
                          <tr key={att.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}>
                            <td style={{ padding: '16px 8px', fontWeight: '600' }}>{att.quiz.title}</td>
                            <td style={{ padding: '16px 8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Calendar size={14} />
                                <span>{new Date(att.startTime).toLocaleDateString()}</span>
                              </div>
                            </td>
                            <td style={{ padding: '16px 8px' }}>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  background: att.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                  color: att.status === 'COMPLETED' ? 'var(--accent-success)' : 'var(--accent-warning)'
                                }}
                              >
                                {att.status}
                              </span>
                            </td>
                            <td style={{ padding: '16px 8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: '800', color: isPassed ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                                  {att.score.toFixed(1)}
                                </span>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/ {att.quiz.totalMarks} ({pct.toFixed(0)}%)</span>
                              </div>
                            </td>
                            <td style={{ padding: '16px 8px' }}>
                              <span style={{ color: att.cheatingStrikes > 0 ? 'var(--accent-danger)' : 'var(--text-muted)', fontWeight: '600' }}>
                                {att.cheatingStrikes} strike{att.cheatingStrikes !== 1 && 's'}
                              </span>
                            </td>
                            <td style={{ padding: '16px 8px', textAlign: 'right' }}>
                              {isPassed ? (
                                <button
                                  className="glass-btn glass-btn-secondary"
                                  style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'var(--accent-success)', color: 'var(--accent-success)', background: 'rgba(16, 185, 129, 0.04)' }}
                                  onClick={() => handleDownloadCertificate(att.id)}
                                >
                                  <Download size={12} />
                                  <span>Download</span>
                                </button>
                              ) : (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Locked (&lt;60%)</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* 3. LEADERBOARDS VIEW */}
            {activeTab === 'leaderboards' && (
              <div>
                <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>Select Quiz Board:</label>
                  <select
                    className="glass-input"
                    style={{ maxWidth: '300px' }}
                    value={selectedQuizId}
                    onChange={handleLeaderboardChange}
                  >
                    {quizzes.map(q => (
                      <option key={q.id} value={q.id}>{q.title}</option>
                    ))}
                  </select>
                </div>

                <div className="glass-panel" style={{ padding: '24px' }}>
                  {leaderboards.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No attempts recorded for this quiz yet. Be the first to top the charts!
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.08)' }}>
                          <th style={{ padding: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>RANK</th>
                          <th style={{ padding: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>STUDENT</th>
                          <th style={{ padding: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>SCORE</th>
                          <th style={{ padding: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>TIME ELAPSED</th>
                          <th style={{ padding: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>INTEGRITY STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboards.map((lb, index) => {
                          const isTopThree = index < 3;
                          const rankColor = index === 0 ? '#EAB308' : index === 1 ? '#9CA3AF' : index === 2 ? '#B45309' : 'var(--text-muted)';
                          return (
                            <tr key={lb.userId} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: isTopThree ? 'rgba(99, 102, 241, 0.02)' : 'none' }}>
                              <td style={{ padding: '16px 12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {isTopThree ? (
                                    <Trophy size={18} style={{ color: rankColor }} />
                                  ) : (
                                    <span style={{ fontSize: '14px', color: 'var(--text-muted)', width: '18px', display: 'inline-block', textAlign: 'center' }}>{index + 1}</span>
                                  )}
                                  <strong style={{ color: isTopThree ? 'white' : 'var(--text-secondary)' }}>#{index + 1}</strong>
                                </div>
                              </td>
                              <td style={{ padding: '16px 12px', fontWeight: '600' }}>
                                <div>
                                  <div>{lb.name}</div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '400' }}>{lb.email}</div>
                                </div>
                              </td>
                              <td style={{ padding: '16px 12px', fontWeight: '800', color: 'var(--accent-primary)', fontSize: '16px' }}>{lb.score.toFixed(1)}</td>
                              <td style={{ padding: '16px 12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                {Math.floor(lb.timeTakenSeconds / 60)}m {lb.timeTakenSeconds % 60}s
                              </td>
                              <td style={{ padding: '16px 12px' }}>
                                {lb.cheatingStrikes > 0 ? (
                                  <span style={{ color: 'var(--accent-warning)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <AlertTriangle size={12} />
                                    <span>{lb.cheatingStrikes} Strikes</span>
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--accent-success)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <CheckCircle2 size={12} />
                                    <span>Perfect Integrity</span>
                                  </span>
                                )}
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
          </div>
        )}
      </main>
    </div>
  );
}
