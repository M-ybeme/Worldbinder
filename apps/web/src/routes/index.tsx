import { createBrowserRouter } from 'react-router-dom'
import { App } from '../app/App'
import { AccountLayout } from '../features/account/components/AccountLayout'
import { ProfilePage } from '../features/account/pages/ProfilePage'
import { SecurityPage } from '../features/account/pages/SecurityPage'
import { SessionsPage } from '../features/account/pages/SessionsPage'
import { RedirectIfAuthenticated } from '../features/auth/components/RedirectIfAuthenticated'
import { RequireAuth } from '../features/auth/components/RequireAuth'
import { ForgotPasswordPage } from '../features/auth/pages/ForgotPasswordPage'
import { LoginPage } from '../features/auth/pages/LoginPage'
import { RegisterPage } from '../features/auth/pages/RegisterPage'
import { ResetPasswordPage } from '../features/auth/pages/ResetPasswordPage'
import { VerifyEmailPage } from '../features/auth/pages/VerifyEmailPage'
import { StatusPage } from '../features/system-status/pages/StatusPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <StatusPage /> },
      { path: 'verify-email', element: <VerifyEmailPage /> },
      {
        element: <RedirectIfAuthenticated />,
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
          { path: 'forgot-password', element: <ForgotPasswordPage /> },
          { path: 'reset-password', element: <ResetPasswordPage /> },
        ],
      },
      {
        path: 'account',
        element: <RequireAuth />,
        children: [
          {
            element: <AccountLayout />,
            children: [
              { index: true, element: <ProfilePage /> },
              { path: 'profile', element: <ProfilePage /> },
              { path: 'security', element: <SecurityPage /> },
              { path: 'sessions', element: <SessionsPage /> },
            ],
          },
        ],
      },
    ],
  },
])
