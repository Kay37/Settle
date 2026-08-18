import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import ShortcutsPage from './ShortcutsPage.tsx'
import './index.css'

const path = window.location.pathname.replace(/\/+$/, '') || '/'
const Root = path === '/shortcuts' ? ShortcutsPage : App

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
