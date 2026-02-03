import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
  Wifi,
  Play,
  Battery,
  Bell,
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
  Printer,
  Church
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
import { SheetTrigger } from "@/components/ui/sheet";
import AISearchBar from "@/components/shared/AISearchBar";
import PushNotificationSetup from "@/components/shared/PushNotificationSetup";
import ToolboxPopover from "@/components/shared/ToolboxPopover";

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
    name: "Meetings",
    path: "MyMeetings",
    icon: CalendarIcon,
    color: "text-purple-500"
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
    name: "SharePoint",
    path: "SharePoint",
    icon: FileSpreadsheet,
    color: "text-cyan-500"
  },
  {
    name: "Documents",
    path: "Documents",
    icon: Folder,
    color: "text-blue-500"
  }
];

const systemApps = [
  {
    name: "FBCA Campus Hub",
    path: "AkitaFetch",
    icon: Church,
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
    path: "GudDeo",
    icon: Battery,
    customIcon: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fb9a0b2d7d369a37662cca/07dd00e30_ChatGPTImageFeb3202612_05_14AM.png",
    color: "text-yellow-500",
    action: null
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
  const [notifications, setNotifications] = useState([]);
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

        // Load notifications
        const userNotifications = await base44.entities.Notification.filter(
          { user_email: currentUser.email, read: false },
          '-created_date',
          10
        );
        setNotifications(userNotifications);
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

    // Refresh notifications every 30 seconds
    const notificationTimer = setInterval(async () => {
      try {
        const currentUser = await base44.auth.me();
        const userNotifications = await base44.entities.Notification.filter(
          { user_email: currentUser.email, read: false },
          '-created_date',
          10
        );
        setNotifications(userNotifications);
      } catch (error) {
        console.error("Error refreshing notifications:", error);
      }
    }, 30000);

    return () => {
      clearInterval(timer);
      clearInterval(notificationTimer);
    };
  }, []);

  const handleLogout = () => {
    base44.auth.logout();
  };

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

  // AI Assistant handlers
  const handleBookingRequest = (person, params) => {
    navigate(createPageUrl('MyMeetings') + `?bookPerson=${encodeURIComponent(person.mail || person.userPrincipalName)}`);
  };

  const handleTicketRequest = (params) => {
    const queryParams = new URLSearchParams();
    if (params.description) queryParams.set('description', params.description);
    if (params.subject) queryParams.set('subject', params.subject);
    if (params.category) queryParams.set('category', params.category);
    navigate(createPageUrl('CreateTicket') + (queryParams.toString() ? `?${queryParams.toString()}` : ''));
  };

  const handleTaskRequest = (params) => {
    navigate(createPageUrl('MyTasks') + `?createTask=true&title=${encodeURIComponent(params.subject || params.description || '')}`);
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
                Click here to connect your accounts and get started! After connecting, enable push notifications from your profile menu for mobile alerts.
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

            {/* Quick Launch - Desktop/Tablet - Show all 6 apps */}
            <div className="hidden sm:flex items-center gap-1">
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
                        {app.customIcon ? (
                          <img src={app.customIcon} alt={app.name} className="w-5 h-5" />
                        ) : (
                          <app.icon className="w-5 h-5 text-white" />
                        )}
                      </div>
                      <span className="font-medium text-slate-900">{app.name}</span>
                    </div>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Center - AI Smart Search */}
          <AISearchBar 
            onBookingRequest={handleBookingRequest}
            onTicketRequest={handleTicketRequest}
            onTaskRequest={handleTaskRequest}
          />

          {/* System Tray */}
          <div className="flex items-center gap-1 md:gap-3">
            {/* System Icons - Hidden on mobile */}
            <div className="hidden lg:flex items-center gap-2">
              <Link to={createPageUrl('AkitaFetch')}>
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors cursor-pointer"
                  title="FBCA Campus Hub"
                >
                  <Church className="w-4 h-4 text-white/80" />
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
              <Link to={createPageUrl('GudDeo')}>
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors cursor-pointer"
                  title="Gud Deo"
                >
                  <img 
                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fb9a0b2d7d369a37662cca/78b5d3cf5_image.png"
                    alt="Gud Deo"
                    className="w-8 h-8 object-contain"
                  />
                </motion.div>
              </Link>
              <motion.div
                whileHover={{ scale: 1.1 }}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors cursor-pointer"
                onClick={() => toast.info('Purpose Printshot - Coming Soon!')}
                title="Purpose Printshot"
              >
                <Printer className="w-4 h-4 text-white/80" />
              </motion.div>

              {/* Toolbox */}
              <ToolboxPopover />
            </div>

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

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="relative w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <Bell className="w-4 h-4 text-white/80" />
                  {notifications.length > 0 && (
                    <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center bg-red-500 text-white text-xs border-2 border-slate-900">
                      {notifications.length}
                    </Badge>
                  )}
                </motion.div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 mb-2 max-h-96 overflow-y-auto">
                <DropdownMenuLabel className="font-semibold flex items-center justify-between">
                  Notifications
                  <Link to={createPageUrl("Notifications")}>
                    <Button variant="ghost" size="sm" className="h-6 text-xs">
                      View All
                    </Button>
                  </Link>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-500">
                    No new notifications
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.slice(0, 5).map((notification) => (
                      <Link 
                        key={notification.id}
                        to={notification.action_url || createPageUrl("Notifications")}
                      >
                        <DropdownMenuItem className="flex-col items-start p-3 cursor-pointer">
                          <p className="font-semibold text-sm text-slate-900 mb-1">
                            {notification.title}
                          </p>
                          <p className="text-xs text-slate-600">
                            {notification.message.substring(0, 80)}
                            {notification.message.length > 80 ? '...' : ''}
                          </p>
                        </DropdownMenuItem>
                      </Link>
                    ))}
                  </div>
                )}
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
                <div className="px-2 py-1.5">
                  <PushNotificationSetup />
                </div>
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