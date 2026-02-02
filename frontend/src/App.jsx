import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/admin/AdminDashboard';
import IpManager from './components/admin/IpManager';
import Settings from './components/admin/Settings';
import About from './components/About';
import Disclaimer from './components/Disclaimer';
import NotFound from './components/NotFound';
import { Fuel } from 'lucide-react';

function App() {
  const [isScrolled, setIsScrolled] = useState(false);

  // Scroll listener
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <Router>
      <div className="flex flex-col min-h-screen bg-neutral-900 text-gray-200 font-sans">
        
        {/* HEADER */}
        <header 
          className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b border-neutral-800 ${
            isScrolled ? 'bg-black/90 backdrop-blur-md py-2 shadow-2xl' : 'bg-neutral-900/50 backdrop-blur-sm py-4 md:py-8'
          }`}
        >
          <div className="max-w-5xl mx-auto px-4 md:px-6 flex flex-row justify-between items-end">
            
            {/* LOGO AREA */}
            <Link to="/" className="group relative flex items-center gap-3">
                {isScrolled ? (
                   // SCROLLED STATE (Flat Logo)
                   <img 
                     src="/logo-flat.webp" 
                     alt="GoNoGo Logo" 
                     className="h-8 md:h-10 w-auto object-contain transition-all" 
                   />
                ) : (
                   // TOP STATE (Square Logo)
                   <img 
                     src="/logo-square.webp" 
                     alt="GoNoGo Logo" 
                     className="w-28 h-28 md:w-52 md:h-52 rounded-xl shadow-2xl group-hover:scale-[1.02] transition-transform duration-300 origin-bottom-left" 
                   />
                )}
            </Link>

            {/* NAVIGATION MENU */}
            <nav className={`flex gap-3 md:gap-6 font-bold uppercase tracking-widest text-neutral-400 transition-all duration-300 pb-1 ${
                isScrolled ? 'text-[10px] md:text-xs' : 'text-[10px] md:text-xs'
            }`}>
               <Link to="/" className="hover:text-white hover:text-blue-400 transition-colors">Home</Link>
               <Link to="/" className="hover:text-white hover:text-blue-400 transition-colors">Report</Link>
               <Link to="/about" className="hover:text-white hover:text-blue-400 transition-colors">About</Link>
               <Link to="/disclaimer" className="hover:text-white hover:text-blue-400 transition-colors">Disclaimer</Link>
            </nav>
            
          </div>
        </header>

        {/* SPACER */}
        <div className={`transition-all duration-300 ${isScrolled ? 'pt-20' : 'pt-32 md:pt-80'}`}></div>

        {/* MAIN CONTENT */}
        <main className="flex-grow w-full p-4 md:p-6 relative z-0">
           <Routes>
             <Route path="/" element={<Dashboard />} />
             <Route path="/about" element={<About />} />
             <Route path="/disclaimer" element={<Disclaimer />} />
             <Route path="/admin" element={<AdminDashboard />} />
             <Route path="/admin/dashboard" element={<AdminDashboard />} />
             <Route path="/admin/ip" element={<IpManager />} />
             <Route path="/admin/settings" element={<Settings />} />

             <Route path="*" element={<NotFound />} />
           </Routes>
        </main>

        {/* FOOTER */}
        <footer className="w-full py-8 text-center border-t border-neutral-800 bg-black text-xs text-neutral-600 space-y-4 relative z-10">
          <p>&copy; {new Date().getFullYear()} GoNoGo AI v0.31 • Built for Pilots • All rights reserved</p>
          <div className="flex flex-col items-center gap-2">
            <span className="text-neutral-500 italic">Help with server and API costs:</span>
            
            <a 
              href="#" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-500 font-bold rounded-full transition-colors border border-yellow-600/50 uppercase tracking-wider text-[10px]"
            >
              <Fuel className="w-3 h-3 md:w-4 md:h-4" strokeWidth={3} />
              <span>Donate: Buy a Fuel Top-Up</span>
            </a>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;