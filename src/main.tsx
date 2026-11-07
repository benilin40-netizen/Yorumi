// Silence harmless WebSocket disconnection rejections behind proxy
window.addEventListener('unhandledrejection', (e) => {
  const msg = String(e.reason?.message || e.reason || '');
  if (msg.includes('WebSocket closed without opened')) e.preventDefault();
});

import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
