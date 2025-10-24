import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Megaphone,
  UtensilsCrossed,
  User,
  Wifi,
  Volume2,
  Battery,
  Bell,
  Search,
  Folder,
  Trash2,
  Settings,
  Grid3x3
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Badge } from "@/components/ui/badge";

const desktopApps = [
  {
    name: "Marketing",
    icon: Megaphone,
    color: "from-purple-500 to-pink-500",
    path: "Marketing",
    position: { x: 50, y: 50 }
  },
  {
    name: "Food Service",
    icon: UtensilsCrossed,
    color: "from-green-500 to-emerald-500",
    path: "FoodService",
    position: { x: 50, y: 180 }
  },
  {
    name: "FBCA Nexts",
    icon: User,
    color: "from-orange-500 to-red-500",
    path: "FBCANexts",
    position: { x: 50, y: 310 }
  },
  {
    name: "Settings",
    icon: Settings,
    color: "from-slate-500 to-slate-600",
    path: "Settings",
    position: { x: 50, y: 440 }
  }
];

export default function Dashboard() {
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

  return (
    <div className="h-[calc(100vh-73px)] relative overflow-hidden">
      {/* Desktop Background */}
      <ContextMenu>
        <ContextMenuTrigger>
          <div 
            className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600"
            style={{
              backgroundImage: `url('https://images.unsplash.com/photo-1557683316-973673baf926?w=1920&q=80')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {/* Desktop Grid Overlay */}
            <div className="absolute inset-0 bg-black/20" />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>
            <Grid3x3 className="w-4 h-4 mr-2" />
            View
          </ContextMenuItem>
          <ContextMenuItem>
            <Folder className="w-4 h-4 mr-2" />
            New Folder
          </ContextMenuItem>
          <ContextMenuItem>
            <Settings className="w-4 h-4 mr-2" />
            Desktop Settings
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Desktop Icons */}
      <div className="relative h-full">
        {desktopApps.map((app, index) => (
          <motion.div
            key={app.name}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="absolute"
            style={{ 
              left: `${app.position.x}px`, 
              top: `${app.position.y}px` 
            }}
          >
            <Link to={createPageUrl(app.path)}>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-white/10 backdrop-blur-sm transition-all cursor-pointer group w-28"
              >
                <div className={`w-16 h-16 bg-gradient-to-br ${app.color} rounded-2xl shadow-2xl flex items-center justify-center group-hover:shadow-3xl transition-shadow`}>
                  <app.icon className="w-8 h-8 text-white" />
                </div>
                <span className="text-white text-sm font-medium text-center drop-shadow-lg">
                  {app.name}
                </span>
              </motion.div>
            </Link>
          </motion.div>
        ))}

        {/* Desktop Shortcuts - Right Side */}
        <div className="absolute right-8 top-8 space-y-4">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-white/10 backdrop-blur-sm transition-all cursor-pointer"
          >
            <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-xl shadow-lg flex items-center justify-center">
              <Folder className="w-7 h-7 text-white" />
            </div>
            <span className="text-white text-xs font-medium drop-shadow-lg">Documents</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-white/10 backdrop-blur-sm transition-all cursor-pointer"
          >
            <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-xl shadow-lg flex items-center justify-center">
              <Trash2 className="w-7 h-7 text-white" />
            </div>
            <span className="text-white text-xs font-medium drop-shadow-lg">Trash</span>
          </motion.div>
        </div>
      </div>

      {/* Taskbar */}
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 30 }}
        className="absolute bottom-0 left-0 right-0 h-16 bg-slate-900/95 backdrop-blur-xl border-t border-white/10 shadow-2xl"
      >
        <div className="h-full px-4 flex items-center justify-between">
          {/* Start Button & Quick Launch */}
          <div className="flex items-center gap-2">
            <Link to={createPageUrl("Dashboard")}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow"
              >
                <span className="text-white font-bold text-sm">FB44</span>
              </motion.button>
            </Link>

            <div className="h-10 w-px bg-white/20 mx-1" />

            {/* Quick Launch Icons */}
            <div className="flex items-center gap-1">
              {desktopApps.slice(0, 3).map((app) => (
                <Link key={app.name} to={createPageUrl(app.path)}>
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <app.icon className="w-5 h-5 text-white/80" />
                  </motion.div>
                </Link>
              ))}
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

            {/* User */}
            <Link to={createPageUrl("FBCANexts")}>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center cursor-pointer shadow-lg"
              >
                <span className="text-white text-sm font-bold">
                  {user?.full_name?.[0]?.toUpperCase() || 'U'}
                </span>
              </motion.div>
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}