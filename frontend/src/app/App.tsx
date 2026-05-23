import { GoogleOAuthProvider } from '@react-oauth/google'
import { RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { router } from './routes'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <RouterProvider router={router} />
      <Toaster position="top-center" richColors />
    </GoogleOAuthProvider>
  )
}
