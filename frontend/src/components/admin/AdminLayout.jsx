import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Network, Settings, Lock, ListVideo } from 'lucide-react';

const AdminLayout = ({ children }) => {
  const location = useLocation();
  const [adminKey, setAdminKey] = useState(localStorage.getItem("gonogo_admin_key"));
  const [inputKey, setInputKey] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();
    if(inputKey.trim()) {
        localStorage.setItem("gonogo_admin_key", inputKey.trim());
        setAdminKey(inputKey.trim());
    }
  };

  const handleLogout = () => {
      localStorage.removeItem("gonogo_admin_key");
      setAdminKey(null);
  };

  // --- AUTH GATE ---
  if (!adminKey) {
      return (
          <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
              <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-xl p-8 space-y-6 shadow-2xl">
                  <div className="text-center space-y-2">
                      <div className="bg-blue-900/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Lock className="w-8 h-8 text-blue-500" />
                      </div>
                      <h1 className="text-2xl font-bold text-white">Admin Access</h1>
                      <p className="text-neutral-400 text-sm">Enter your System Secret Key to proceed.</p>
                  </div>
                  <form onSubmit={handleLogin} className="space-y-4">
                      <input 
                        type="password" 
                        value={inputKey}
                        onChange={(e) => setInputKey(e.target.value)}
                        placeholder="sk_..."
                        className="w-full bg-black border border-neutral-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                        autoFocus
                      />
                      <button 
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors"
                      >
                          UNLOCK SYSTEM
                      </button>
                  </form>
              </div>
          </div>
      );
  }

  const NavItem = ({ to, icon: Icon, label }) => {
    const isActive = location.pathname === to;
    return (
      <Link 
        to={to} 
        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm font-bold uppercase tracking-wider ${
          isActive 
            ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30' 
            : 'text-neutral-500 hover:bg-neutral-800 hover:text-white'
        }`}
      >
        <Icon size={18} />
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-black pt-20">
      
      {/* SIDEBAR */}
      <aside className="w-full lg:w-64 p-4 border-r border-neutral-800 lg:min-h-[80vh] flex flex-col justify-between">
        <div>
            <div className="mb-6 px-4">
                <h2 className="text-white font-black text-xl tracking-tighter">COMMAND DECK</h2>
                <p className="text-[10px] text-neutral-500 uppercase">System Admin</p>
            </div>
            <nav className="space-y-1">
            <NavItem to="/admin/dashboard" icon={LayoutDashboard} label="Overview" />
            <NavItem to="/admin/logs" icon={ListVideo} label="Live Logs" />
            <NavItem to="/admin/ip" icon={Network} label="IP Manager" />
            <NavItem to="/admin/settings" icon={Settings} label="Settings" />
            </nav>
        </div>
        
        <div className="p-4">
            <button onClick={handleLogout} className="text-xs text-red-500 hover:text-red-400 uppercase font-bold tracking-wider">
                Log Out
            </button>
        </div>
      </aside>

      {/* CONTENT AREA */}
      <main className="flex-1 p-4 lg:p-8 overflow-x-auto relative">
        {children}
      </main>
    </div>
  );
};

export default AdminLayout;