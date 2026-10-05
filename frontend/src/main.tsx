import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App';

// Ensure legacy theme state is purged and document is strictly in standard light appearance
try {
  localStorage.removeItem('kisanconnect-theme');
  document.documentElement.classList.remove('dark');
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.colorScheme = 'light';
} catch (e) {
  // Ignore in environments where localStorage is restricted
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

