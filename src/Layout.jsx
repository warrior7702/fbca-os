
import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import EmailDomainCheck from "@/components/layout/EmailDomainCheck"; // Keep if needed, currently commented out in JSX
import {
  LayoutDashboard,
  Megaphone,
  UtensilsCrossed,
  User,
  Wifi,
  Volume2,
  Battery,
  Bell,
  Search,
  Settings,
  LogOut,
  ChevronDown,
  Layers,
  Users,
  Loader2,
  Folder,
  ListChecks, // Used for My Tasks app and Task Results search
  ClipboardCheck, // NEW: for My Approvals app
  Sparkles
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";

const apps = [
  {
    name: "Dashboard",
    path: "Dashboard",
    icon: LayoutDashboard,
    color: "text-blue-500"
  },
  {
    name: "My Tasks",
    path: "MyTasks",
    icon: ListChecks,
    color: "text-indigo-500"
  },
  {
    name: "My Approvals",
    path: "MyApprovals",
    icon: ClipboardCheck,
    color: "text-orange-500"
  },
  {
    name: "Marketing",
    path: "Marketing",
    icon: Megaphone,
    color: "text-purple-500"
  },
  {
    name: "Food Service",
    path: "FoodService",
    icon: UtensilsCrossed,
    color: "text-green-500"
  },
  {
    name: "Staff Directory",
    path: "StaffDirectory",
    icon: Users,
    color: "text-teal-500"
  }
];

// Wallpaper URLs
const wallpapers = {
  church_steeple_night: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fb9a0b2d7d369a37662cca/c4c5d5f09_ChatGPTImageOct25202502_23_44AM.png",
  church_building_blue: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fb9a0b2d7d369a37662cca/3e3148244_ChatGPTImageOct25202502_24_10AM.png",
  cross_chrome_blue: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fb9a0b2d7d369a37662cca/ad26483c6_ChatGPTImageOct25202502_25_20AM.png",
  cross_white_glow: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fb9a0b2d7d369a37662cca/a221e8e71_ChatGPTImageOct25202502_30_15AM.png",
  cross_metal_texture: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fb9a0b2d7d369a37662cca/dcac8ecf7_ChatGPTImageOct25202502_35_35AM.png"
};

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notifications] = useState(3);
  const [searchQuery, setSearchQuery] = useState("");
  // Updated searchResults state to include tasks
  const [searchResults, setSearchResults] = useState({ staff: [], files: [], modules: [], tasks: [] });
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef(null);
  const [hasConnectionAlert, setHasConnectionAlert] = useState(false);
  const [showLightBubble, setShowLightBubble] = useState(false);
  const [wallpaper, setWallpaper] = useState("cross_white_glow"); // Initialize with a default wallpaper

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        
        // Load wallpaper preference
        if (currentUser.wallpaper) {
          setWallpaper(currentUser.wallpaper);
        }
        
        // Check if user needs to connect accounts
        const hasPCO = !!currentUser?.pco_access_token;
        const hasClickUp = !!currentUser?.clickup_access_token;
        const hasMicrosoft = !!currentUser?.microsoft_access_token;
        const missingConnections = !hasPCO || !hasClickUp || !hasMicrosoft;
        
        setHasConnectionAlert(missingConnections);
        
        // Show bubble after a delay if there are missing connections
        if (missingConnections && !sessionStorage.getItem('lightBubbleDismissed')) {
          setTimeout(() => setShowLightBubble(true), 2000);
        }
      } catch (error) {
        console.error("Error loading user:", error);
        // User is not logged in or there was an error - show the alert
        // This alerts the user to connect accounts, which includes logging in if not authenticated.
        setHasConnectionAlert(true);
        if (!sessionStorage.getItem('lightBubbleDismissed')) {
          setTimeout(() => setShowLightBubble(true), 2000);
        }
      }
    };
    loadUser();

    // Update clock every second
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Click outside to close search results
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      clearInterval(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Debounced live search
  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (searchQuery.length >= 2) {
        performLiveSearch(searchQuery);
      } else {
        setSearchResults({ staff: [], files: [], modules: [], tasks: [] }); // Clear tasks as well
        setShowResults(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  const performLiveSearch = async (query) => {
    setSearching(true);
    setShowResults(true);

    console.log('🔍 Starting live search for:', query);

    try {
      const lowerQuery = query.toLowerCase();
      const newResults = { staff: [], files: [], modules: [], tasks: [] };

      // Search staff
      console.log('📋 Searching staff...');
      const staffResponse = await base44.entities.StaffContact.filter({});
      
      newResults.staff = (staffResponse || [])
        .filter(person => {
          return person.full_name?.toLowerCase().includes(lowerQuery) ||
                 person.first_name?.toLowerCase().includes(lowerQuery) ||
                 person.last_name?.toLowerCase().includes(lowerQuery) ||
                 person.email?.toLowerCase().includes(lowerQuery);
        })
        .slice(0, 5);
      console.log('✅ Found', newResults.staff.length, 'staff members');

      // Search modules
      console.log('📦 Searching modules...');
      newResults.modules = apps
        .filter(app => 
          app.name.toLowerCase().includes(lowerQuery) ||
          app.path.toLowerCase().includes(lowerQuery)
        )
        .slice(0, 3);
      console.log('✅ Found', newResults.modules.length, 'modules');

      // Search files (already grouped by folder from backend)
      try {
        console.log('📁 Searching OneDrive files...');
        const filesResponse = await base44.functions.invoke('searchOneDrive', { query });
        console.log('📁 OneDrive response:', filesResponse.data);
        newResults.files = (filesResponse.data.files || []).slice(0, 5);
        console.log('✅ Found', newResults.files.length, 'files/folders');
        if (newResults.files.length > 0) {
          console.log('📁 File results:', newResults.files.map(f => ({ name: f.name, isFolder: f.isFolder })));
        }
      } catch (error) {
        console.error('❌ File search error:', error);
        console.error('Error details:', error.response?.data || error.message);
      }

      // Search ClickUp tasks
      try {
        console.log('✅ Searching ClickUp tasks...');
        const tasksResponse = await base44.functions.invoke('searchClickUpTasks', { query });
        console.log('✅ ClickUp tasks response:', tasksResponse.data);
        // Assuming tasksResponse.data contains an array of task objects
        newResults.tasks = (tasksResponse.data || []).slice(0, 5);
        console.log('✅ Found', newResults.tasks.length, 'tasks');
      } catch (error) {
        console.error('❌ ClickUp task search error:', error);
        console.error('Error details:', error.response?.data || error.message);
      }

      console.log('🎯 Final results:', {
        staff: newResults.staff.length,
        modules: newResults.modules.length,
        files: newResults.files.length,
        tasks: newResults.tasks.length
      });

      setSearchResults(newResults);
    } catch (error) {
      console.error('❌ Live search error:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleLogout = () => {
    base44.auth.logout();
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(createPageUrl('Search') + `?q=${encodeURIComponent(searchQuery)}`);
      setSearchQuery("");
      setShowResults(false);
    }
  };

  const handleResultClick = (type, item) => {
    setShowResults(false);
    setSearchQuery("");
    
    if (type === 'module') {
      navigate(createPageUrl(item.path));
    } else if (type === 'file') {
      window.open(item.webUrl, '_blank');
    } else if (type === 'staff') {
      // Navigate to Staff Directory with this person pre-filtered
      navigate(createPageUrl('StaffDirectory') + `?name=${encodeURIComponent(item.full_name)}`);
    } else if (type === 'task') { // Handle task clicks
      window.open(item.url, '_blank'); // Assuming item.url exists for tasks
    }
  };

  // Updated totalResults to include tasks
  const totalResults = searchResults.staff.length + searchResults.files.length + searchResults.modules.length + searchResults.tasks.length;

  const handleDismissLightBubble = () => {
    setShowLightBubble(false);
    sessionStorage.setItem('lightBubbleDismissed', 'true');
  };

  // Get wallpaper URL
  const wallpaperUrl = wallpapers[wallpaper] || wallpapers.cross_white_glow;

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-no-repeat bg-fixed"
      style={{
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.3)), url('${wallpaperUrl}')`
      }}
    >
      <style>{`
        .fbca-logo-taskbar {
          filter: drop-shadow(0 2px 4px rgba(59, 130, 246, 0.4));
        }
      `}</style>

      {/* Email Domain Check - DISABLED */}
      {/* {user && <EmailDomainCheck user={user} exceptionEmail="warrior7702@gmail.com" />} */}

      {/* Main Content - Full Height */}
      <main className="h-screen pb-16">
        {children}
      </main>

      {/* Light Helper Bubble */}
      <AnimatePresence>
        {showLightBubble && hasConnectionAlert && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="fixed bottom-24 right-6 z-[60] max-w-xs"
          >
            <div className="bg-white rounded-2xl shadow-2xl border-2 border-yellow-400 p-4 relative">
              <button
                onClick={handleDismissLightBubble}
                className="absolute -top-2 -right-2 w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center hover:bg-slate-700 transition-colors text-xs"
              >
                ×
              </button>
              
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                <span className="text-xs font-semibold text-yellow-600 uppercase tracking-wide">
                  The Light
                </span>
              </div>

              <p className="text-slate-700 text-sm mb-3 leading-relaxed">
                Click here to connect your accounts and get started!
              </p>

              <Link to={createPageUrl("Settings") + "?tab=integrations"} onClick={handleDismissLightBubble}>
                <Button className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-slate-900 font-medium shadow-lg text-sm h-9">
                  Connect Now →
                </Button>
              </Link>

              {/* Speech bubble tail */}
              <div className="absolute -bottom-2 right-8 w-4 h-4 bg-white border-r-2 border-b-2 border-yellow-400 transform rotate-45" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Taskbar - Always Visible */}
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 30 }}
        className="fixed bottom-0 left-0 right-0 h-16 bg-slate-900/95 backdrop-blur-xl border-t border-white/10 shadow-2xl z-50"
      >
        <div className="h-full px-4 flex items-center justify-between">
          {/* Start Button & Quick Launch */}
          <div className="flex items-center gap-2">
            <Link to={createPageUrl("Dashboard")}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow p-1.5"
              >
                <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fb9a0b2d7d369a37662cca/0bf40efc2_FBCA_AppIcon_Ryl_web.png"
                  alt="FBCA"
                  className="w-full h-full object-contain fbca-logo-taskbar"
                />
              </motion.button>
            </Link>

            <div className="h-10 w-px bg-white/20 mx-1" />

            {/* Quick Launch / Open Apps */}
            <div className="flex items-center gap-1">
              {apps.map((app) => {
                const isActive = location.pathname === createPageUrl(app.path);
                return (
                  <Link key={app.name} to={createPageUrl(app.path)}>
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-white/20 shadow-inner' 
                          : 'bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <app.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-white/60'}`} />
                    </motion.div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Center - Smart Search */}
          <div className="flex-1 max-w-md mx-8 relative" ref={searchRef}>
            <form onSubmit={handleSearch}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 z-10" />
                <input
                  type="text"
                  placeholder="Search apps, files, ClickUp tasks, and people..." // Updated placeholder
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
                  className="w-full h-9 pl-10 pr-4 bg-white/5 hover:bg-white/10 focus:bg-white/10 border border-white/10 rounded-lg text-white placeholder-white/40 text-sm outline-none transition-colors relative z-10"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 animate-spin z-10" />
                )}
              </div>
            </form>

            {/* Live Search Results Dropdown */}
            {showResults && totalResults > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-12 left-0 right-0 bg-white rounded-lg shadow-2xl border border-slate-200 max-h-96 overflow-y-auto z-50"
              >
                {/* Staff Results */}
                {searchResults.staff.length > 0 && (
                  <div className="p-2">
                    <div className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase">
                      Staff ({searchResults.staff.length})
                    </div>
                    {searchResults.staff.map((person) => (
                      <button
                        key={person.id}
                        onClick={() => handleResultClick('staff', person)}
                        className="w-full flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-semibold">
                            {person.first_name && person.first_name.length > 0 && person.last_name && person.last_name.length > 0
                                ? `${person.first_name[0]}${person.last_name[0]}`
                                : person.full_name?.[0]?.toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{person.full_name}</p>
                          <p className="text-xs text-slate-500 truncate">{person.title || person.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Module Results */}
                {searchResults.modules.length > 0 && (
                  <div className="p-2 border-t border-slate-100">
                    <div className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase">
                      Modules ({searchResults.modules.length})
                    </div>
                    {searchResults.modules.map((module) => (
                      <button
                        key={module.path}
                        onClick={() => handleResultClick('module', module)}
                        className="w-full flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors text-left"
                      >
                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <module.icon className={`w-4 h-4 ${module.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900">{module.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* File Results */}
                {searchResults.files.length > 0 && (
                  <div className="p-2 border-t border-slate-100">
                    <div className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase">
                      Files ({searchResults.files.length})
                    </div>
                    {searchResults.files.map((file) => (
                      <button
                        key={file.id}
                        onClick={() => handleResultClick('file', file)}
                        className="w-full flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors text-left"
                      >
                        <Folder className={`w-4 h-4 flex-shrink-0 ${file.isFolder ? 'text-blue-500' : 'text-slate-400'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                          {file.isFolder && file.fileCount && (
                            <p className="text-xs text-slate-500">{file.fileCount} file{file.fileCount !== 1 ? 's' : ''}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Task Results */}
                {searchResults.tasks.length > 0 && (
                  <div className="p-2 border-t border-slate-100">
                    <div className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase">
                      Tasks ({searchResults.tasks.length})
                    </div>
                    {searchResults.tasks.map((task) => (
                      <button
                        key={task.id}
                        onClick={() => handleResultClick('task', task)}
                        className="w-full flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors text-left"
                      >
                        <ListChecks className="w-4 h-4 flex-shrink-0 text-amber-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{task.name}</p>
                          {task.listName && (
                            <p className="text-xs text-slate-500 truncate">{task.listName}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* View All Results */}
                <div className="p-2 border-t border-slate-100">
                  <button
                    onClick={() => {
                      navigate(createPageUrl('Search') + `?q=${encodeURIComponent(searchQuery)}`);
                      setShowResults(false);
                      setSearchQuery("");
                    }}
                    className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium py-2"
                  >
                    View all results for "{searchQuery}"
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          {/* System Tray */}
          <div className="flex items-center gap-3">
            {/* System Icons */}
            <div className="flex items-center gap-2">
              <motion.div
                whileHover={{ scale: 1.1 }}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Wifi className="w-4 h-4 text-white/80" />
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.1 }}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Volume2 className="w-4 h-4 text-white/80" />
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.1 }}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Battery className="w-4 h-4 text-white/80" />
              </motion.div>
            </div>

            <div className="h-8 w-px bg-white/20" />

            {/* AI Helper */}
            <Link to={createPageUrl('AIHelper')}>
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="relative w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors cursor-pointer group"
              >
                <Sparkles className={`w-4 h-4 ${hasConnectionAlert ? 'text-yellow-300' : 'text-yellow-600'}`} />
                {/* Glow effect - only when there's an alert */}
                {hasConnectionAlert && (
                  <motion.div
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.5, 0.8, 0.5],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="absolute inset-0 bg-yellow-400 rounded blur-md opacity-50"
                  />
                )}
              </motion.div>
            </Link>

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="relative w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <Bell className="w-4 h-4 text-white/80" />
                  {notifications > 0 && (
                    <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center bg-red-500 text-white text-xs border-2 border-slate-900">
                      {notifications}
                    </Badge>
                  )}
                </motion.div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 mb-2">
                <DropdownMenuLabel className="font-semibold">Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="p-4 text-center text-sm text-slate-500">
                  No new notifications
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="h-8 w-px bg-white/20" />

            {/* Clock & Date */}
            <div className="text-right cursor-pointer hover:bg-white/10 px-3 py-1 rounded transition-colors">
              <div className="text-white text-sm font-medium leading-tight">
                {format(currentTime, 'h:mm a')}
              </div>
              <div className="text-white/60 text-xs leading-tight">
                {format(currentTime, 'MMM d, yyyy')}
              </div>
            </div>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center cursor-pointer shadow-lg"
                >
                  <span className="text-white text-sm font-bold">
                    {user?.full_name?.[0]?.toUpperCase() || 'U'}
                  </span>
                </motion.div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 mb-2">
                <DropdownMenuLabel>
                  <div>
                    <p className="font-medium">{user?.full_name || 'User'}</p>
                    <p className="text-xs text-slate-500 font-normal">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {/* Profile link updated to point to Settings profile tab */}
                <DropdownMenuItem asChild>
                  <Link to={createPageUrl("Settings") + "?tab=profile"} className="cursor-pointer"> 
                    <User className="w-4 h-4 mr-2" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to={createPageUrl("Settings")} className="cursor-pointer">
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
