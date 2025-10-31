import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'

const APP_VERSION = '0.2.3';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
