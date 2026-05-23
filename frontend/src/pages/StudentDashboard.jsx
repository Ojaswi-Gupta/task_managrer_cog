import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Award, BookOpen, Clock, Calendar, CheckCircle2, ChevronRight, LogOut, Trophy, AlertTriangle, Download, Eye, X } from 'lucide-react';

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
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

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

  const handleReviewAttempt = async (attemptId) => {
    try {
      const res = await axios.get(`${API_URL}/attempts/${attemptId}`);
      setSelectedAttempt(res.data);
      setShowReviewModal(true);
    } catch (err) {
      alert('Failed to fetch attempt details.');
    }
  };

  const handleDownloadCertificate = (attemptId) => {
    // Open in a new window using authenticated download
    const win = window.open(`${API_URL}/certificates/${attemptId}?token=${localStorage.getItem('token')}`, '_blank');
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
                        <th style={{ padding: '12px 8px', fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'right' }}>ACTIONS</th>
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
                            <td style={{ padding: '16px 8px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                              {/* Student-side Answers Review Button */}
                              {(() => {
                                const submitTime = new Date(att.endTime || att.startTime).getTime();
                                const timeSinceSubmit = Date.now() - submitTime;
                                const oneHourMs = 60 * 60 * 1000;
                                const isUnlocked = timeSinceSubmit >= oneHourMs;
                                const remainingMs = oneHourMs - timeSinceSubmit;
                                const remainingMins = Math.ceil(remainingMs / (1000 * 60));

                                if (isUnlocked) {
                                  return (
                                    <button
                                      className="glass-btn glass-btn-secondary"
                                      style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)', background: 'rgba(99, 102, 241, 0.04)' }}
                                      onClick={() => handleReviewAttempt(att.id)}
                                    >
                                      <Eye size={12} />
                                      <span>Review Quiz</span>
                                    </button>
                                  );
                                } else {
                                  return (
                                    <span 
                                      style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--glass-border)', cursor: 'help' }}
                                      title="For security, answer keys unlock exactly 1 hour after exam completion."
                                    >
                                      <Clock size={11} style={{ color: 'var(--accent-warning)' }} />
                                      <span>Review Locked ({remainingMins}m)</span>
                                    </span>
                                  );
                                }
                              })()}

                              {/* Certificate Download Link */}
                              {isPassed ? (
                                <button
                                  className="glass-btn glass-btn-secondary"
                                  style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'var(--accent-success)', color: 'var(--accent-success)', background: 'rgba(16, 185, 129, 0.04)' }}
                                  onClick={() => handleDownloadCertificate(att.id)}
                                >
                                  <Download size={12} />
                                  <span>Certificate</span>
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
                    <div>
                      {/* 🏆 Olympic Glassmorphic Leaderboard Podium */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'flex-end',
                        gap: '16px',
                        margin: '20px auto 40px auto',
                        maxWidth: '650px',
                        padding: '24px 16px 16px 16px',
                        background: 'rgba(255, 255, 255, 0.01)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '16px',
                        position: 'relative'
                      }}>
                        {/* 2nd Place Podium Column (Left) */}
                        {leaderboards[1] && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, maxWidth: '160px' }}>
                            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                              <strong style={{ color: 'white', display: 'block', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>
                                {leaderboards[1].name}
                              </strong>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Score: {leaderboards[1].score.toFixed(1)}</span>
                            </div>
                            <div 
                              className="glass-panel"
                              style={{
                                width: '100%',
                                height: '90px',
                                border: '2px solid rgba(156, 163, 175, 0.4)', // Silver
                                boxShadow: '0 0 20px rgba(156, 163, 175, 0.1)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(156, 163, 175, 0.04)',
                                position: 'relative'
                              }}
                            >
                              <span style={{ fontSize: '28px', fontWeight: '800', color: 'rgba(156, 163, 175, 0.65)' }}>2</span>
                              <span style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-secondary)', letterSpacing: '1px' }}>SILVER</span>
                            </div>
                          </div>
                        )}

                        {/* 1st Place Podium Column (Center Raised) */}
                        {leaderboards[0] && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, maxWidth: '180px', transform: 'translateY(-14px)' }}>
                            <div style={{ fontSize: '22px', animation: 'bounce 2s infinite', marginBottom: '2px', lineHeight: 1 }}>👑</div>
                            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                              <strong style={{ color: 'white', display: 'block', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>
                                {leaderboards[0].name}
                              </strong>
                              <span style={{ fontSize: '12px', color: 'var(--accent-primary)', fontWeight: '800' }}>Score: {leaderboards[0].score.toFixed(1)}</span>
                            </div>
                            <div 
                              className="glass-panel"
                              style={{
                                width: '100%',
                                height: '130px',
                                border: '2px solid rgba(234, 179, 8, 0.5)', // Gold
                                boxShadow: '0 0 25px rgba(234, 179, 8, 0.15)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(234, 179, 8, 0.05)',
                                position: 'relative'
                              }}
                            >
                              <span style={{ fontSize: '38px', fontWeight: '800', color: 'rgba(234, 179, 8, 0.8)' }}>1</span>
                              <span style={{ fontSize: '10px', fontWeight: '800', color: '#EAB308', letterSpacing: '1px' }}>CHAMPION</span>
                            </div>
                          </div>
                        )}

                        {/* 3rd Place Podium Column (Right) */}
                        {leaderboards[2] && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, maxWidth: '160px' }}>
                            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                              <strong style={{ color: 'white', display: 'block', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>
                                {leaderboards[2].name}
                              </strong>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Score: {leaderboards[2].score.toFixed(1)}</span>
                            </div>
                            <div 
                              className="glass-panel"
                              style={{
                                width: '100%',
                                height: '70px',
                                border: '2px solid rgba(180, 83, 9, 0.4)', // Bronze
                                boxShadow: '0 0 15px rgba(180, 83, 9, 0.08)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(180, 83, 9, 0.04)',
                                position: 'relative'
                              }}
                            >
                              <span style={{ fontSize: '24px', fontWeight: '800', color: 'rgba(180, 83, 9, 0.6)' }}>3</span>
                              <span style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', letterSpacing: '1px' }}>BRONZE</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Standard Rankings List Table */}
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
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 🛡️ INTERACTIVE STUDENT ANSWER REVIEW MODAL */}
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
                STUDENT EVALUATION SUMMARY
              </span>
              <h2 style={{ fontSize: '22px', fontWeight: '800', marginTop: '4px' }}>
                {selectedAttempt.quiz.title}
              </h2>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                <div>Status: <strong style={{ color: 'var(--accent-primary)' }}>{selectedAttempt.status}</strong></div>
                <div>Your Score: <strong style={{ color: 'white' }}>{selectedAttempt.score.toFixed(1)} / {selectedAttempt.quiz.totalMarks}</strong></div>
                {selectedAttempt.cheatingStrikes > 0 && (
                  <div style={{ color: 'var(--accent-danger)', fontWeight: '700' }}>Strikes Logged: {selectedAttempt.cheatingStrikes}</div>
                )}
              </div>
            </div>

            {/* Answers List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {selectedAttempt.answers.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>
                  No answers were captured for this attempt (unanswered exam submission).
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
                          {isCorrect ? 'Correct (+Marks)' : studentChoice === null ? 'Skipped' : 'Incorrect (Neg Deducted)'}
                        </span>
                      </div>

                      <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', lineHeight: '1.4' }}>
                        {qText}
                      </p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                        <div>
                          <span style={{ color: 'var(--text-secondary)' }}>Your Selection: </span>
                          <strong style={{ color: studentChoice ? (isCorrect ? 'var(--accent-success)' : 'var(--accent-danger)') : 'var(--text-muted)' }}>
                            {studentChoice ? (
                              studentChoice.split(',').map(choice => `${choice}: ${ans.question[`option${choice.trim()}`]}`).join(', ')
                            ) : '[Unanswered]'}
                          </strong>
                        </div>
                        
                        {!isCorrect && (
                          <div>
                            <span style={{ color: 'var(--text-secondary)' }}>Correct Answer Key: </span>
                            <strong style={{ color: 'var(--accent-success)' }}>
                              {correctChoice ? (
                                correctChoice.split(',').map(choice => `${choice}: ${ans.question[`option${choice.trim()}`]}`).join(', ')
                              ) : ''}
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
