import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ToastProvider } from './components/common/Toast.jsx'
import { PipelineProvider } from './store/PipelineProvider.jsx'
import { ThemeProvider } from './theme/ThemeProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <PipelineProvider>
          <App />
        </PipelineProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
)
