import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
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
  Layers
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
import { motion } from "framer-motion";
import { format } from "date-fns";

const apps = [
  {
    name: "Dashboard",
    path: "Dashboard",
    icon: LayoutDashboard,
    color: "text-blue-500"
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
    name: "FBCA Nexts",
    path: "FBCANexts",
    icon: User,
    color: "text-orange-500"
  }
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notifications] = useState(3);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();

    // Update clock every second
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    base44.auth.logout();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <style>{`
        .fbca-logo-taskbar {
          filter: drop-shadow(0 2px 4px rgba(59, 130, 246, 0.4));
        }
      `}</style>

      {/* Main Content - Full Height */}
      <main className="h-screen pb-16">
        {children}
      </main>

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

          {/* Center - Search */}
          <div className="flex-1 max-w-md mx-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="Search apps and files..."
                className="w-full h-9 pl-10 pr-4 bg-white/5 hover:bg-white/10 focus:bg-white/10 border border-white/10 rounded-lg text-white placeholder-white/40 text-sm outline-none transition-colors"
              />
            </div>
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
                <DropdownMenuItem asChild>
                  <Link to={createPageUrl("FBCANexts")} className="cursor-pointer">
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

      {/* Base 44 Badge */}
      <div className="fixed bottom-20 right-4 z-50">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-full shadow-lg text-xs text-slate-600">
          <Layers className="w-3 h-3 text-blue-500" />
          <span className="font-medium">Powered by Base 44</span>
        </div>
      </div>
    </div>
  );
}