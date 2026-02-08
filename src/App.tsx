import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SettingsProvider } from "@/lib/settings";
import { LoadingScreen } from "@/components/ui/LoadingSpinner";

// Pages
import Splash from "./pages/Splash";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Admin Pages
import AdminDashboard from "./pages/admin/Dashboard";
import Employees from "./pages/admin/Employees";
import AdminTasks from "./pages/admin/Tasks";
import Attendance from "./pages/admin/Attendance";
import AttendanceSchedule from "./pages/admin/AttendanceSchedule";
import LeaveRequests from "./pages/admin/LeaveRequests";
import AdminSettings from "./pages/admin/Settings";
import AdminNotifications from "./pages/admin/Notifications";
// Employee Pages
import EmployeeDashboard from "./pages/employee/Dashboard";
import EmployeeTasks from "./pages/employee/Tasks";
import EmployeeProfile from "./pages/employee/Profile";
import EmployeeHistory from "./pages/employee/History";
import EmployeeSettings from "./pages/employee/Settings";
import EmployeeNotifications from "./pages/employee/Notifications";

const queryClient = new QueryClient();

function ProtectedRoute({ 
  children, 
  requiredRole 
}: { 
  children: ReactNode; 
  requiredRole?: 'admin' | 'employee';
}) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (requiredRole && role !== requiredRole) {
    // Redirect to appropriate dashboard
    return <Navigate to={role === 'admin' ? '/admin' : '/employee'} replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Splash />} />
      <Route path="/auth" element={user ? <Navigate to={role === 'admin' ? '/admin' : '/employee'} replace /> : <Auth />} />

      {/* Admin Routes */}
      <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/employees" element={<ProtectedRoute requiredRole="admin"><Employees /></ProtectedRoute>} />
      <Route path="/admin/tasks" element={<ProtectedRoute requiredRole="admin"><AdminTasks /></ProtectedRoute>} />
      <Route path="/admin/attendance" element={<ProtectedRoute requiredRole="admin"><Attendance /></ProtectedRoute>} />
      <Route path="/admin/attendance-schedule" element={<ProtectedRoute requiredRole="admin"><AttendanceSchedule /></ProtectedRoute>} />
      <Route path="/admin/leave-requests" element={<ProtectedRoute requiredRole="admin"><LeaveRequests /></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute requiredRole="admin"><AdminSettings /></ProtectedRoute>} />
      <Route path="/admin/notifications" element={<ProtectedRoute requiredRole="admin"><AdminNotifications /></ProtectedRoute>} />

      {/* Employee Routes */}
      <Route path="/employee" element={<ProtectedRoute requiredRole="employee"><EmployeeDashboard /></ProtectedRoute>} />
      <Route path="/employee/tasks" element={<ProtectedRoute requiredRole="employee"><EmployeeTasks /></ProtectedRoute>} />
      <Route path="/employee/profile" element={<ProtectedRoute requiredRole="employee"><EmployeeProfile /></ProtectedRoute>} />
      <Route path="/employee/history" element={<ProtectedRoute requiredRole="employee"><EmployeeHistory /></ProtectedRoute>} />
      <Route path="/employee/settings" element={<ProtectedRoute requiredRole="employee"><EmployeeSettings /></ProtectedRoute>} />
      <Route path="/employee/notifications" element={<ProtectedRoute requiredRole="employee"><EmployeeNotifications /></ProtectedRoute>} />

      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <SettingsProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AppRoutes />
          </BrowserRouter>
        </SettingsProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
