import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ConvexClientProvider } from './src/providers/ConvexClientProvider';

// Suppress specific console logs
const originalConsoleLog = console.log;
const originalConsoleInfo = console.info;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

const shouldSuppress = (args: any[]) => {
  const msg = args.join(' ');
  return (
    msg.includes('Download the React DevTools') ||
    msg.includes('THREE.WebGLRenderer: Context Lost')
  );
};

console.log = (...args) => {
  if (!shouldSuppress(args)) originalConsoleLog(...args);
};

console.info = (...args) => {
  if (!shouldSuppress(args)) originalConsoleInfo(...args);
};

console.warn = (...args) => {
  if (!shouldSuppress(args)) originalConsoleWarn(...args);
};

console.error = (...args) => {
  if (!shouldSuppress(args)) originalConsoleError(...args);
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ConvexClientProvider>
      <App />
    </ConvexClientProvider>
  </React.StrictMode>
);