// Router — mirrors the production route table (ARCHITECTURE.md §3).
// Protected teacher routes render inside AppShell; public + token routes are bare.

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from './lib/theme'
import { AuthProvider, useAuth } from './lib/auth'
import { FeatureGateProvider } from './lib/featureGate'
import { ToastProvider } from './components/ui'
import AppShell from './components/AppShell'
import Landing from './routes/Landing'
import Login from './routes/Login'
import Signup from './routes/Signup'
import AuthConfirm from './routes/AuthConfirm'
import ResetPassword from './routes/ResetPassword'
import Dashboard from './routes/Dashboard'
import Students, { StudentDetail } from './routes/Students'
import Calendar from './routes/Calendar'
import { Messages } from './routes/Messages'
import BillingPage from './routes/BillingPage'
import Settings from './routes/Settings'
import LessonNotes from './routes/LessonNotes'
import Assignments from './routes/Assignments'
import Resources from './routes/Resources'
import Families from './routes/Families'
import Programs from './routes/Programs'
import Forms from './routes/Forms'
import Upgrade from './routes/Upgrade'
import FamilyPortal, { FamilyLogin } from './routes/FamilyPortal'
import { StudentLogin, StudentPortal } from './routes/Portal'
import DirectoryLeads from './routes/DirectoryLeads'
import FamilyDirectory from './routes/FamilyDirectory'
import NotFound from './routes/NotFound'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  return user ? <>{children}</> : <Navigate to="/app-login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <ToastProvider>
      <AuthProvider>
        <FeatureGateProvider>
          <Routes>
            {/* public */}
            <Route path="/" element={<Landing />} />
            <Route path="/app-login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/auth/confirm" element={<AuthConfirm />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/student-login" element={<StudentLogin />} />
            <Route path="/student-portal" element={<StudentPortal />} />
            <Route path="/family-login" element={<FamilyLogin />} />
            <Route path="/family-portal" element={<FamilyPortal />} />

            {/* public token flows */}
            <Route path="/pay/:token" element={<NotFound />} />
            <Route path="/form/:token" element={<NotFound />} />
            <Route path="/enroll/:slug" element={<NotFound />} />

            {/* authenticated teacher app */}
            <Route element={<RequireAuth><AppShell /></RequireAuth>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/students" element={<Students />} />
              <Route path="/students/:slug" element={<StudentDetail />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/billing" element={<BillingPage />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/lesson-notes" element={<LessonNotes />} />
              <Route path="/assignments" element={<Assignments />} />
              <Route path="/resources" element={<Resources />} />
              <Route path="/families" element={<Families />} />
              <Route path="/families/:id" element={<Families />} />
              <Route path="/programs" element={<Programs />} />
              <Route path="/programs/:id" element={<Programs />} />
              <Route path="/forms" element={<Forms />} />
              <Route path="/directory-leads" element={<DirectoryLeads />} />
              <Route path="/family-directory" element={<FamilyDirectory />} />
              <Route path="/upgrade" element={<Upgrade />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </FeatureGateProvider>
      </AuthProvider>
      </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
