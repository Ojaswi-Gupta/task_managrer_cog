import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sun, Moon } from 'lucide-react';

// Components
import ThreeCanvas from './components/ThreeCanvas';
import QuizBot from './components/QuizBot';

// Pages
import Login from './pages/Login';
import StudentDashboard from './pages/StudentDashboard';
import ExamPage from './pages/ExamPage';
import AdminDashboard from './pages/AdminDashboard';

// Role-Based Protection wrappers
function ProtectedRoute({ children }) {
  const { user, token } = useAuth();
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function AdminRoute({ children }) {
  const { user, token } = useAuth();
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }
  return children;
}

// Global Floating Glassmorphic Theme Toggle Button
function ThemeToggle() {
  const { theme, toggleTheme } = useAuth();
  return (
    <button
      onClick={toggleTheme}
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: '50%',
        width: '46px',
        height: '46px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 8px 32px 0 var(--glass-shadow)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        outline: 'none'
      }}
      title={`Switch to ${theme === 'midnight' ? 'Aurora Light' : 'Midnight Space'} Mode`}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.1) translateY(-2px)';
        e.currentTarget.style.borderColor = 'var(--accent-primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1) translateY(0)';
        e.currentTarget.style.borderColor = 'var(--glass-border)';
      }}
    >
      {theme === 'midnight' ? (
        <Sun size={20} style={{ color: 'var(--accent-warning)' }} />
      ) : (
        <Moon size={20} style={{ color: 'var(--accent-primary)' }} />
      )}
    </button>
  );
}

function AppContent() {
  return (
    <BrowserRouter>
      {/* Persistent 3D Interactive Starfield Layer */}
      <ThreeCanvas />

      {/* Floating Theme Switcher */}
      <ThemeToggle />

      {/* Floating QuizBot AI Companion */}
      <QuizBot />

      <Routes>
        {/* Public Auth Endpoint */}
        <Route path="/login" element={<Login />} />

        {/* Student Protected Endpoints */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/exam/:attemptId"
          element={
            <ProtectedRoute>
              <ExamPage />
            </ProtectedRoute>
          }
        />

        {/* Instructor/Admin Protected Endpoints */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />

        {/* Fallback Route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
