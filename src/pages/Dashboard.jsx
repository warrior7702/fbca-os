
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Megaphone,
  UtensilsCrossed,
  User,
  Folder,
  Trash2,
  Settings,
  Grid3x3,
  Users // Added Users icon
} from "lucide-react";
import { motion } from "framer-motion";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

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
    name: "Staff Directory",
    icon: Users,
    color: "from-teal-500 to-cyan-500",
    path: "StaffDirectory",
    position: { x: 50, y: 310 } // Adjusted position
  },
  {
    name: "Settings",
    icon: Settings,
    color: "from-slate-500 to-slate-600",
    path: "Settings",
    position: { x: 50, y: 440 } // Adjusted position
  }
];

export default function Dashboard() {
  const [user, setUser] = useState(null);

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
  }, []);

  return (
    <div className="h-full relative overflow-hidden">
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
          >
            <Link to={createPageUrl("Documents")}>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-white/10 backdrop-blur-sm transition-all cursor-pointer"
              >
                <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-xl shadow-lg flex items-center justify-center">
                  <Folder className="w-7 h-7 text-white" />
                </div>
                <span className="text-white text-xs font-medium drop-shadow-lg">Documents</span>
              </motion.div>
            </Link>
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
    </div>
  );
}
