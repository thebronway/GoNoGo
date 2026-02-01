import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Admin from './components/Admin';

function App() {
  return (
    <Router>
      <div className="flex flex-col min-h-screen bg-neutral-900 text-gray-200 font-sans">
        
        {/* HEADER */}
        <header className="p-6 border-b border-neutral-800 bg-neutral-900/50">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold text-white tracking-tight">GoNoGo AI</h1>
            <span className="text-xs uppercase tracking-widest text-neutral-500">Flight Assistant</span>
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main className="flex-grow w-full p-6">
           <Routes>
             {/* The Dashboard lives at root / */}
             <Route path="/" element={<Dashboard />} />
             
             {/* The Log Viewer lives at /admin */}
             <Route path="/admin" element={<Admin />} />
           </Routes>
        </main>

        {/* FOOTER */}
        <footer className="w-full py-8 text-center border-t border-neutral-800 bg-black text-xs text-neutral-600 space-y-4">
          <p>GoNoGo AI v0.2 • Built for Pilots</p>
          <div>
            <a 
              href="#" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-500 font-bold rounded-full transition-colors border border-yellow-600/50 uppercase tracking-wider text-[10px]"
            >
              <span>⛽</span>
              <span>Buy Me a Fuel Top-Up</span>
            </a>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;