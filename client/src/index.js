import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { SocketProvider } from './context/SocketContext';
import { JobProvider } from './context/JobContext';
import './styles/App.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <SocketProvider>
        <JobProvider>
          <App />
          <Toaster 
            position="top-right"
            toastOptions={{
              style: { background: '#ffffff', color: '#0f172a', border: '1px solid #e2e8f0' }
            }}
          />
        </JobProvider>
      </SocketProvider>
    </BrowserRouter>
  </React.StrictMode>
);
