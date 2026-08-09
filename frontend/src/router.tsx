import { createBrowserRouter, Navigate } from 'react-router'
import { lazy, Suspense } from 'react'
import { AppShell } from './components/layout/AppShell'
import { RoleGuard } from './components/layout/RoleGuard'
import LoginScreen from './screens/LoginScreen'
import { useAuthStore } from './store/auth'

// eslint-disable-next-line react-refresh/only-export-components
function IndexRedirect() {
  const role = useAuthStore((s) => s.user?.role)
  if (role === 'operator') return <Navigate to="/sessions/sess-001/mode" replace />
  return <Navigate to="/home" replace />
}

const HomeScreen = lazy(() => import('./screens/HomeScreen'))
const TemplateListScreen = lazy(() => import('./screens/constructor/TemplateListScreen'))
const ConstructorScreen = lazy(() => import('./screens/constructor/ConstructorScreen'))
const ComponentLibraryScreen = lazy(() => import('./screens/constructor/ComponentLibraryScreen'))
const ScenarioEditorScreen = lazy(() => import('./screens/instructor/ScenarioEditorScreen'))
const InstructorConsole = lazy(() => import('./screens/instructor/InstructorConsole'))
const SessionObserveScreen = lazy(() => import('./screens/instructor/SessionObserveScreen'))
const ModeSelectScreen = lazy(() => import('./screens/operator/ModeSelectScreen'))
const TrainingScreen = lazy(() => import('./screens/operator/TrainingScreen'))
const ExamScreen = lazy(() => import('./screens/operator/ExamScreen'))
const ReportListScreen = lazy(() => import('./screens/report/ReportListScreen'))
const ReportScreen = lazy(() => import('./screens/report/ReportScreen'))
const ReplayScreen = lazy(() => import('./screens/report/ReplayScreen'))
const UsersScreen = lazy(() => import('./screens/admin/UsersScreen'))
const SystemScreen = lazy(() => import('./screens/admin/SystemScreen'))

// eslint-disable-next-line react-refresh/only-export-components
function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="loading-spinner" />}>{children}</Suspense>
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginScreen />,
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <IndexRedirect />,
      },
      {
        path: 'home',
        element: (
          <RoleGuard roles={['instructor', 'admin']}>
            <Lazy>
              <HomeScreen />
            </Lazy>
          </RoleGuard>
        ),
      },
      {
        path: 'templates',
        element: (
          <RoleGuard roles={['instructor', 'admin']}>
            <Lazy>
              <TemplateListScreen />
            </Lazy>
          </RoleGuard>
        ),
      },
      {
        path: 'templates/:id/edit',
        element: (
          <RoleGuard roles={['instructor', 'admin']}>
            <Lazy>
              <ConstructorScreen />
            </Lazy>
          </RoleGuard>
        ),
      },
      {
        path: 'components',
        element: (
          <RoleGuard roles={['instructor', 'admin']}>
            <Lazy>
              <ComponentLibraryScreen />
            </Lazy>
          </RoleGuard>
        ),
      },
      {
        path: 'scenarios',
        element: (
          <RoleGuard roles={['instructor', 'admin']}>
            <Lazy>
              <ScenarioEditorScreen />
            </Lazy>
          </RoleGuard>
        ),
      },
      {
        path: 'scenarios/:id',
        element: (
          <RoleGuard roles={['instructor', 'admin']}>
            <Lazy>
              <ScenarioEditorScreen />
            </Lazy>
          </RoleGuard>
        ),
      },
      {
        path: 'sessions',
        element: (
          <RoleGuard roles={['instructor', 'admin']}>
            <Lazy>
              <InstructorConsole />
            </Lazy>
          </RoleGuard>
        ),
      },
      {
        path: 'sessions/:id/observe',
        element: (
          <RoleGuard roles={['instructor', 'admin']}>
            <Lazy>
              <SessionObserveScreen />
            </Lazy>
          </RoleGuard>
        ),
      },
      {
        path: 'sessions/:id/operator',
        element: (
          <RoleGuard roles={['operator', 'instructor', 'admin']}>
            <Lazy>
              <TrainingScreen />
            </Lazy>
          </RoleGuard>
        ),
      },
      {
        path: 'sessions/:id/mode',
        element: (
          <RoleGuard roles={['operator', 'instructor', 'admin']}>
            <Lazy>
              <ModeSelectScreen />
            </Lazy>
          </RoleGuard>
        ),
      },
      {
        path: 'sessions/:id/exam',
        element: (
          <RoleGuard roles={['operator']}>
            <Lazy>
              <ExamScreen />
            </Lazy>
          </RoleGuard>
        ),
      },
      {
        path: 'reports',
        element: (
          <RoleGuard roles={['operator', 'instructor', 'admin']}>
            <Lazy>
              <ReportListScreen />
            </Lazy>
          </RoleGuard>
        ),
      },
      {
        path: 'reports/:id',
        element: (
          <RoleGuard roles={['operator', 'instructor', 'admin']}>
            <Lazy>
              <ReportScreen />
            </Lazy>
          </RoleGuard>
        ),
      },
      {
        path: 'reports/:id/replay',
        element: (
          <RoleGuard roles={['operator', 'instructor', 'admin']}>
            <Lazy>
              <ReplayScreen />
            </Lazy>
          </RoleGuard>
        ),
      },
      {
        path: 'admin/users',
        element: (
          <RoleGuard roles={['admin']}>
            <Lazy>
              <UsersScreen />
            </Lazy>
          </RoleGuard>
        ),
      },
      {
        path: 'admin/system',
        element: (
          <RoleGuard roles={['admin']}>
            <Lazy>
              <SystemScreen />
            </Lazy>
          </RoleGuard>
        ),
      },
    ],
  },
])
