import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Components
import ThreeCanvas from './components/ThreeCanvas';

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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        {/* Persistent 3D Interactive Starfield Layer */}
        <ThreeCanvas />

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
    </AuthProvider>
  );
}
