import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Megaphone, Fuel } from 'lucide-react'; 
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/admin/AdminDashboard';
import LiveLogs from './components/admin/LiveLogs';
import IpManager from './components/admin/IpManager';
import Settings from './components/admin/Settings';
import About from './components/About';
import Disclaimer from './components/Disclaimer';
import ReportPage from './components/ReportPage';
import NotFound from './components/NotFound';

// Wrapper component to use hooks inside Router context
const AppContent = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [banner, setBanner] = useState(null); 
  const [hasResults, setHasResults] = useState(false); // Track if Dashboard has results
  const location = useLocation(); // Track current page

  useEffect(() => {
    // 1. Handle Scroll
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);

    // 2. Fetch Banner
    const fetchBanner = async () => {
        try {
            const res = await fetch("/api/system-status");
            if(res.ok) {
                const data = await res.json();
                if(data.banner_enabled && data.banner_message) {
                    setBanner(data.banner_message);
                } else {
                    setBanner(null);
                }
            }
        } catch(e) {
            console.error("Failed to load system status", e);
        }
    };
    fetchBanner();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // --- LOGO VISIBILITY LOGIC ---
  const isHomePage = location.pathname === '/';
  // Show logo if: We are NOT on home page OR we scrolled OR we have search results
  const showLogo = !isHomePage || isScrolled || hasResults;

  return (
      <div className="flex flex-col min-h-screen bg-neutral-900 text-gray-200 font-sans">
        
        {/* HEADER */}
        <header 
          className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${
            isScrolled 
                ? 'bg-black/90 backdrop-blur-md py-2 shadow-2xl border-neutral-800' 
                : 'bg-transparent py-4 md:py-8 border-transparent'
          }`}
        >
          <div className="max-w-5xl mx-auto px-4 md:px-6 flex flex-row justify-between items-center h-10 md:h-12">
            
            {/* LOGO AREA */}
            <Link 
                to="/" 
                className={`group relative flex items-center transition-all duration-500 ${
                    showLogo ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
                }`}
            >
               <img src="/logo-flat.webp" alt="GoNoGo Logo" className="h-8 md:h-10 w-auto object-contain" />
            </Link>

            {/* NAVIGATION MENU */}
            <nav className="flex gap-2 md:gap-8 font-bold uppercase tracking-wide md:tracking-widest text-neutral-400 text-[9px] md:text-xs whitespace-nowrap">
               <Link to="/" className="hover:text-white hover:text-blue-400 transition-colors">Home</Link>
               <Link to="/report" className="hover:text-white hover:text-blue-400 transition-colors">Report</Link>
               <Link to="/about" className="hover:text-white hover:text-blue-400 transition-colors">About</Link>
               <Link to="/disclaimer" className="hover:text-white hover:text-blue-400 transition-colors">Disclaimer</Link>
            </nav>
            
          </div>
        </header>

        {/* SPACER */}
        <div className="pt-24 md:pt-32"></div>

        {/* SITE-WIDE BANNER */}
        {banner && (
            <div className="max-w-5xl mx-auto px-4 md:px-6 w-full mb-6 animate-fade-in">
                <div className="bg-blue-900/20 border border-blue-800 text-blue-300 px-4 py-3 rounded-lg flex items-center gap-3 shadow-lg backdrop-blur-md">
                    <Megaphone size={20} className="animate-pulse shrink-0" />
                    <span className="font-bold text-sm tracking-wide">{banner}</span>
                </div>
            </div>
        )}

        {/* MAIN CONTENT */}
        <main className="flex-grow w-full p-4 md:p-6 relative z-0">
           <Routes>
             {/* Pass setHasResults to Dashboard so it can tell us when to show the logo */}
             <Route path="/" element={<Dashboard onSearchStateChange={setHasResults} />} />
             <Route path="/about" element={<About />} />
             <Route path="/disclaimer" element={<Disclaimer />} />
             <Route path="/report" element={<ReportPage />} />
             
             {/* Admin Routes */}
             <Route path="/admin" element={<AdminDashboard />} />
             <Route path="/admin/dashboard" element={<AdminDashboard />} />
             <Route path="/admin/logs" element={<LiveLogs />} />
             <Route path="/admin/ip" element={<IpManager />} />
             <Route path="/admin/settings" element={<Settings />} />

             <Route path="*" element={<NotFound />} />
           </Routes>
        </main>

        {/* FOOTER */}
        <footer className="w-full py-8 text-center border-t border-neutral-800 bg-black text-xs text-neutral-600 space-y-4 relative z-10">
          <p>&copy; {new Date().getFullYear()} GoNoGo AI v0.55 • Built for Pilots • All rights reserved</p>
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
  );
};

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;