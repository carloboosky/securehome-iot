import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ClientDashboard from "./pages/ClientDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import HomePage from "./pages/HomePage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import ServiceRequestPage from "./pages/ServiceRequestPage";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthProvider from "./contexts/AuthContext";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider><Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegisterPage />} />
        <Route path="/completar-registro" element={<ProtectedRoute allow="client"><ServiceRequestPage /></ProtectedRoute>} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/dashboard" element={<ProtectedRoute allow="client"><ClientDashboard /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute allow="admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes></AuthProvider>
    </BrowserRouter>
  );
}

export default App;
