import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Lock, Mail, User, ShieldAlert, BookOpen } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false); // Quick toggle helper for resume presentation
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cohorts, setCohorts] = useState([]);
  const [cohortId, setCohortId] = useState('');

  useEffect(() => {
    if (isRegister && !isAdmin) {
      axios.get(`${API_URL}/auth/cohorts`)
        .then(res => {
          setCohorts(res.data);
          if (res.data.length > 0) {
            setCohortId(res.data[0].id.toString());
          }
        })
        .catch(err => {
          console.error("Failed to load classroom sections for signup:", err);
        });
    }
  }, [isRegister, isAdmin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        const payload = await register(
          name, 
          email, 
          password, 
          isAdmin ? 'ADMIN' : 'STUDENT', 
          !isAdmin ? cohortId : null
        );
        navigate(payload.user.role === 'ADMIN' ? '/admin' : '/');
      } else {
        const payload = await login(email, password);
        navigate(payload.user.role === 'ADMIN' ? '/admin' : '/');
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '24px'
      }}
    >
      <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '8px' }}>
            <span className="shimmer-text">QuizPortal</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            {isRegister ? 'Create your credentials to begin evaluation' : 'Sign in to access quizzes and leaderboards'}
          </p>
        </div>

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: 'var(--accent-danger)',
              fontSize: '13px',
              marginBottom: '20px'
            }}
          >
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isRegister && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Full Name</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '12px', top: '15px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  required
                  placeholder="John Doe"
                  className="glass-input"
                  style={{ paddingLeft: '38px' }}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '12px', top: '15px', color: 'var(--text-muted)' }} />
              <input
                type="email"
                required
                placeholder="student@quizportal.com"
                className="glass-input"
                style={{ paddingLeft: '38px' }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '15px', color: 'var(--text-muted)' }} />
              <input
                type="password"
                required
                placeholder="••••••••"
                className="glass-input"
                style={{ paddingLeft: '38px' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {isRegister && !isAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Assign Classroom Section</label>
              <div style={{ position: 'relative' }}>
                <BookOpen size={16} style={{ position: 'absolute', left: '12px', top: '15px', color: 'var(--text-muted)' }} />
                <select
                  required
                  className="glass-input"
                  style={{ paddingLeft: '38px', cursor: 'pointer' }}
                  value={cohortId}
                  onChange={(e) => setCohortId(e.target.value)}
                >
                  <option value="" disabled>-- Select Your Section --</option>
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} - {c.section}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {isRegister && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <input
                type="checkbox"
                id="admin-chk"
                style={{ cursor: 'pointer' }}
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
              />
              <label htmlFor="admin-chk" style={{ fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Register as Instructor/Admin
              </label>
            </div>
          )}

          <button
            type="submit"
            className="glass-btn glass-btn-primary"
            style={{ width: '100%', marginTop: '12px' }}
            disabled={loading}
          >
            {loading ? 'Processing...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <span>{isRegister ? 'Already have an account? ' : "Don't have an account? "}</span>
          <button
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-primary)',
              fontWeight: '700',
              cursor: 'pointer',
              outline: 'none'
            }}
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
          >
            {isRegister ? 'Sign In' : 'Create One'}
          </button>
        </div>

        {/* Demo Accounts Quick-Helper (Invaluable for Interviewers reviewing from Git!) */}
        <div
          style={{
            marginTop: '24px',
            padding: '12px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.04)',
            fontSize: '11px',
            color: 'var(--text-muted)'
          }}
        >
          <div style={{ fontWeight: '700', marginBottom: '6px', color: 'var(--text-secondary)' }}>💡 QUICK DEMO ACCOUNTS:</div>
          <div>• **Student**: student@quizportal.com / password: **student123**</div>
          <div style={{ marginTop: '2px' }}>• **Admin**: admin@quizportal.com / password: **admin123**</div>
        </div>
      </div>
    </div>
  );
}
