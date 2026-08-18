import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import ShortcutsPage from './ShortcutsPage.tsx'
import WidgetPage from './WidgetPage.tsx'
import './index.css'

const path = window.location.pathname.replace(/\/+$/, '') || '/'
const Root =
  path === '/shortcuts' ? ShortcutsPage : path === '/widget' ? WidgetPage : App

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
