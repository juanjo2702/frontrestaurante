import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import ConnectionStatus from '../ui/ConnectionStatus';
import { Menu, Search, Bell } from 'lucide-react';
import { motion } from 'framer-motion';

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-[#080809] via-[#0c0c0f] to-[#0a0a0d] text-white font-sans">
      {/* Sidebar - Desktop: sticky, Mobile: fixed overlay */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Top Header */}
        <motion.header 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="h-14 sm:h-16 flex items-center justify-between px-3 sm:px-4 lg:px-6 border-b border-white/5 bg-black/20 backdrop-blur-xl sticky top-0 z-30 shrink-0"
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 sm:p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-300 hover:text-white transition-all"
            >
              <Menu size={18} />
            </motion.button>
            
            {/* Search Bar (Desktop) */}
            <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg w-64 lg:w-72 group hover:border-white/20 transition-all">
              <Search size={16} className="text-gray-500 group-hover:text-gray-400 transition-colors" />
              <input 
                type="text"
                placeholder="Buscar..."
                className="bg-transparent text-sm text-white placeholder-gray-500 outline-none flex-1 min-w-0"
              />
              <kbd className="hidden lg:inline px-1.5 py-0.5 text-[10px] text-gray-500 bg-white/5 rounded border border-white/10">⌘K</kbd>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ConnectionStatus />
            
            {/* Notifications */}
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative p-2 sm:p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-all"
            >
              <Bell size={16} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            </motion.button>
          </div>
        </motion.header>

        {/* Main Content */}
        <main className="flex-1 p-2 sm:p-4 lg:p-6 overflow-x-hidden overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>

        {/* Footer - Hidden on mobile */}
        <footer className="hidden sm:block py-3 px-4 border-t border-white/5 text-center shrink-0">
          <p className="text-[10px] sm:text-xs text-gray-600">
            © 2026 GUSTO.BO • v2.0.0
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Layout;
