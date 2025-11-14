
import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
  Wifi,
  Play,
  Battery,
  Bell,
  Search,
  Settings,
  LogOut,
  User,
  Loader2,
  Folder,
  ListChecks,
  ClipboardCheck,
  Sparkles,
  Calendar as CalendarIcon,
  Building2,
  MessageSquare,
  UtensilsCrossed,
  Users,
  Ticket,
  FileSpreadsheet,
  Menu,
  X,
  Printer
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
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SheetTrigger } from "@/components/ui/sheet"; // Ensure SheetTrigger is imported

const apps = [
  {
    name: "Tasks",
    path: "MyTasks",
    icon: ListChecks,
    color: "text-indigo-500"
  },
  {
    name: "Approvals",
    path: "MyApprovals",
    icon: ClipboardCheck,
    color: "text-orange-500"
  },
  {
    name: "My Department",
    path: "MyDepartment",
    icon: Building2,
    color: "text-violet-500"
  },
  {
    name: "Church Calendar",
    path: "Calendar",
    icon: CalendarIcon,
    color: "text-blue-600"
  },
  {
    name: "Documents",
    path: "Documents",
    icon: Folder,
    color: "text-blue-500"
  },
  {
    name: "SharePoint",
    path: "SharePoint",
    icon: FileSpreadsheet,
    color: "text-green-600"
  }
];

const systemApps = [
  {
    name: "AkitaFetch",
    path: "AkitaFetch",
    icon: Building2,
    color: "text-blue-500",
    action: null
  },
  {
    name: "Media Player",
    path: "MediaPlayer",
    icon: Play,
    color: "text-green-500",
    action: null
  },
  {
    name: "Network Helper",
    path: null,
    icon: Wifi,
    color: "text-blue-500",
    action: () => toast.info('FBCA Network Helper - Coming Soon!')
  },
  {
    name: "Gud Deo",
    path: null,
    icon: Battery,
    color: "text-yellow-500",
    action: () => toast.info('Gud Deo - Coming Soon!')
  },
  {
    name: "Printshot",
    path: null,
    icon: Printer,
    color: "text-purple-500",
    action: () => toast.info('Purpose Printshot - Coming Soon!')
  }
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notifications] = useState(3);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState({ staff: [], files: [], modules: [] });
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef(null);
  const [hasConnectionAlert, setHasConnectionAlert] = useState(false);
  const [showLightBubble, setShowLightBubble] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        
        const hasPCO = !!currentUser?.pco_access_token;
        const hasClickUp = !!currentUser?.clickup_access_token;
        const hasMicrosoft = !!currentUser?.microsoft_access_token;
        const missingConnections = !hasPCO || !hasClickUp || !hasMicrosoft;
        
        setHasConnectionAlert(missingConnections);
        
        if (missingConnections && !sessionStorage.getItem('lightBubbleDismissed')) {
          setTimeout(() => setShowLightBubble(true), 2000);
        }
      } catch (error) {
        console.error("Error loading user:", error);
        setHasConnectionAlert(true);
        if (!sessionStorage.getItem('lightBubbleDismissed')) {
          setTimeout(() => setShowLightBubble(true), 2000);
        }
      }
    };
    loadUser();

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

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

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (searchQuery.length >= 2) {
        performLiveSearch(searchQuery);
      } else {
        setSearchResults({ staff: [], files: [], modules: [] });
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  const performLiveSearch = async (query) => {
    setSearching(true);

    try {
      const lowerQuery = query.toLowerCase();
      const newResults = { staff: [], files: [], modules: [] };

      // Search staff
      try {
        const staffResponse = await base44.entities.StaffContact.filter({});
        
        newResults.staff = (staffResponse || [])
          .filter(person => {
            return person.full_name?.toLowerCase().includes(lowerQuery) ||
                   person.first_name?.toLowerCase().includes(lowerQuery) ||
                   person.last_name?.toLowerCase().includes(lowerQuery) ||
                   person.email?.toLowerCase().includes(lowerQuery);
          })
          .slice(0, 5);
      } catch (staffError) {
        console.error('Staff search error:', staffError);
      }

      // Search modules
      newResults.modules = apps
        .filter(app => 
          app.name.toLowerCase().includes(lowerQuery) ||
          app.path.toLowerCase().includes(lowerQuery)
        )
        .slice(0, 3);

      // Search files
      try {
        const filesResponse = await base44.functions.invoke('searchOneDrive', { query });
        newResults.files = (filesResponse.data.files || []).slice(0, 5);
      } catch (fileError) {
        console.error('File search error:', fileError);
      }

      setSearchResults(newResults);
      
      const total = newResults.staff.length + newResults.files.length + newResults.modules.length;
      if (total > 0) {
        setShowResults(true);
      }
      
    } catch (error) {
      console.error('Live search error:', error);
      setSearchResults({ staff: [], files: [], modules: [] });
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
      navigate(createPageUrl('StaffDirectory') + `?name=${encodeURIComponent(item.full_name)}`);
    }
  };

  const totalResults = searchResults.staff.length + searchResults.files.length + searchResults.modules.length;

  const handleDismissLightBubble = () => {
    setShowLightBubble(false);
    sessionStorage.setItem('lightBubbleDismissed', 'true');
  };

  const handleSystemAppClick = (app) => {
    setMobileMenuOpen(false);
    if (app.path) {
      navigate(createPageUrl(app.path));
    } else if (app.action) {
      app.action();
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Main Content */}
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
            className="fixed bottom-20 md:bottom-24 right-4 md:right-6 z-[60] max-w-xs"
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

              <div className="absolute -bottom-2 right-8 w-4 h-4 bg-white border-r-2 border-b-2 border-yellow-400 transform rotate-45" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Taskbar */}
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 30 }}
        className="fixed bottom-0 left-0 right-0 h-16 bg-slate-900/95 backdrop-blur-xl border-t border-white/10 shadow-2xl z-50"
      >
        <div className="h-full px-2 md:px-4 flex items-center justify-between">
          {/* Start Button & Quick Launch */}
          <div className="flex items-center gap-1 md:gap-2">
            <Link to={createPageUrl("Dashboard")}>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-10 h-10 rounded-lg flex items-center justify-center cursor-pointer bg-white/5 hover:bg-white/10 transition-colors p-1.5"
              >
                <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fb9a0b2d7d369a37662cca/25312a75d_FBCA_AppIcon_Wht2000px.png"
                  alt="FBCA"
                  className="w-full h-full object-contain"
                />
              </motion.div>
            </Link>

            <div className="h-10 w-px bg-white/20 mx-0.5 md:mx-1 hidden sm:block" />

            {/* Quick Launch - Desktop/Tablet */}
            <div className="hidden sm:flex items-center gap-1">
              {apps.slice(0, 4).map((app) => {
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

            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="sm:hidden text-white">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Apps</SheetTitle>
                </SheetHeader>
                
                {/* Main Apps */}
                <div className="mt-6 space-y-2">
                  {apps.map((app) => (
                    <Link 
                      key={app.name} 
                      to={createPageUrl(app.path)}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                        <div className={`w-10 h-10 bg-gradient-to-br ${app.color.replace('text-', 'from-')} to-slate-300 rounded-lg flex items-center justify-center`}>
                          <app.icon className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-medium text-slate-900">{app.name}</span>
                      </div>
                    </Link>
                  ))}
                </div>

                {/* Divider */}
                <div className="my-4 border-t border-slate-200" />

                {/* System Apps */}
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-3 mb-2">
                    System Tools
                  </p>
                  {systemApps.map((app) => (
                    <div
                      key={app.name}
                      onClick={() => handleSystemAppClick(app)}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <div className={`w-10 h-10 bg-gradient-to-br ${app.color.replace('text-', 'from-')} to-slate-300 rounded-lg flex items-center justify-center`}>
                        <app.icon className="w-5 h-5 text-white" />
                      </div>
                      <span className="font-medium text-slate-900">{app.name}</span>
                    </div>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Center - Smart Search */}
          <div className="flex-1 max-w-md mx-2 md:mx-8 relative" ref={searchRef}>
            <form onSubmit={handleSearch}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 z-10" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (searchQuery.length >= 2 && totalResults > 0) {
                      setShowResults(true);
                    }
                  }}
                  className="w-full h-9 pl-10 pr-4 bg-white/5 hover:bg-white/10 focus:bg-white/10 border border-white/10 rounded-lg text-white placeholder-white/40 text-sm outline-none transition-colors relative z-10"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 animate-spin z-10" />
                )}
              </div>
            </form>

            {/* Live Search Results */}
            {showResults && totalResults > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-12 left-0 right-0 bg-white rounded-lg shadow-2xl border border-slate-200 max-h-96 overflow-y-auto z-50"
              >
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
          <div className="flex items-center gap-1 md:gap-3">
            {/* System Icons - Hidden on mobile */}
            <div className="hidden lg:flex items-center gap-2">
              <Link to={createPageUrl('AkitaFetch')}>
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors cursor-pointer"
                  title="AkitaFetch"
                >
                  <Building2 className="w-4 h-4 text-white/80" />
                </motion.div>
              </Link>
              <motion.div
                whileHover={{ scale: 1.1 }}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors cursor-pointer"
                onClick={() => toast.info('FBCA Network Helper - Coming Soon!')}
                title="FBCA Network Helper"
              >
                <Wifi className="w-4 h-4 text-white/80" />
              </motion.div>
              <Link to={createPageUrl('MediaPlayer')}>
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors cursor-pointer"
                  title="FBCA Media Player"
                >
                  <Play className="w-4 h-4 text-white/80" />
                </motion.div>
              </Link>
              <motion.div
                whileHover={{ scale: 1.1 }}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors cursor-pointer"
                onClick={() => toast.info('Gud Deo - Coming Soon!')}
                title="Gud Deo"
              >
                <Battery className="w-4 h-4 text-white/80" />
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.1 }}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors cursor-pointer"
                onClick={() => toast.info('Purpose Printshot - Coming Soon!')}
                title="Purpose Printshot"
              >
                <Printer className="w-4 h-4 text-white/80" />
              </motion.div>
            </div>

            <div className="h-8 w-px bg-white/20 hidden lg:block" />

            {/* AI Helper */}
            <Link to={createPageUrl('AIHelper')}>
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="relative w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors cursor-pointer group"
              >
                <Sparkles className={`w-4 h-4 ${hasConnectionAlert ? 'text-yellow-300' : 'text-yellow-600'}`} />
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

            {/* Notifications - Hidden on small mobile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="relative w-8 h-8 hidden xs:flex items-center justify-center rounded hover:bg-white/10 transition-colors cursor-pointer"
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

            <div className="h-8 w-px bg-white/20 hidden md:block" />

            {/* Clock & Date - Simplified on mobile */}
            <div className="text-right cursor-pointer hover:bg-white/10 px-2 md:px-3 py-1 rounded transition-colors">
              <div className="text-white text-sm font-medium leading-tight">
                {format(currentTime, 'h:mm a')}
              </div>
              <div className="text-white/60 text-xs leading-tight hidden sm:block">
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
