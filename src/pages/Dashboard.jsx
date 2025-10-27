
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
  Users,
  ListChecks,
  ClipboardCheck,
  Unlock,
  Mail // NEW: Import Mail icon for Email app
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const defaultApps = [
  // Renamed categories and added Email app
  { id: "mytasks", name: "Tasks", icon: ListChecks, color: "from-blue-500 to-indigo-500", path: "MyTasks" },
  { id: "myapprovals", name: "Approvals", icon: ClipboardCheck, color: "from-orange-500 to-red-500", path: "MyApprovals" },
  { id: "marketing", name: "Marketing", icon: Megaphone, color: "from-purple-500 to-pink-500", path: "Marketing" },
  { id: "foodservice", name: "Hospitality", icon: UtensilsCrossed, color: "from-green-500 to-emerald-500", path: "FoodService" },
  { id: "staffdir", name: "Directory", icon: Users, color: "from-teal-500 to-cyan-500", path: "StaffDirectory" },
  { id: "settings", name: "Settings", icon: Settings, color: "from-slate-500 to-slate-600", path: "Settings" },
  { id: "email", name: "Email", icon: Mail, color: "from-blue-600 to-sky-400", path: "mailto:" } // New Email app
];

// Removed wallpapers object - now handled in Layout

const COLS = 6;
const ROWS = 4;

const getDefaultPositions = () => {
  const positions = {};
  defaultApps.forEach((app, index) => {
    // Ensure new apps also get default positions
    positions[app.id] = {
      row: Math.floor(index / 2),
      col: index % 2
    };
  });
  return positions;
};

export default function Dashboard() {
  const [user, setUser] = useState(null);
  // Removed wallpaper state - now handled in Layout
  const [editMode, setEditMode] = useState(false);
  const [appPositions, setAppPositions] = useState(getDefaultPositions());
  const [draggedApp, setDraggedApp] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    // Check if edit mode is enabled in URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('edit') === 'true') {
      setEditMode(true);
      toast.info('Drag icons to rearrange');
    }
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      // Removed wallpaper loading - now handled in Layout
      
      // IMPORTANT: Only set layout if it exists AND has actual data
      if (currentUser.desktop_layout && 
          typeof currentUser.desktop_layout === 'object' && 
          Object.keys(currentUser.desktop_layout).length > 0) {
        console.log('Loading saved layout:', currentUser.desktop_layout);
        setAppPositions(currentUser.desktop_layout);
      } else {
        console.log('Using default layout');
        // Make sure default positions are set
        setAppPositions(getDefaultPositions());
      }
    } catch (error) {
      console.error("Error loading user:", error);
      // On error, ensure we have default positions
      setAppPositions(getDefaultPositions());
    }
  };

  const handleDragStart = (e, app) => {
    if (!editMode) return;
    setDraggedApp(app);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, row, col) => {
    e.preventDefault();
    if (!editMode || !draggedApp) return;

    const occupied = Object.entries(appPositions).find(
      ([id, pos]) => id !== draggedApp.id && pos.row === row && pos.col === col
    );

    if (occupied) {
      toast.error('Spot already taken!');
      setDraggedApp(null);
      return;
    }

    const newPositions = {
      ...appPositions,
      [draggedApp.id]: { row, col }
    };
    
    setAppPositions(newPositions);
    setDraggedApp(null);
    
    try {
      await base44.auth.updateMe({ desktop_layout: newPositions });
      toast.success('Icon moved!');
    } catch (error) {
      console.error("Error saving layout:", error);
      toast.error('Failed to save layout');
    }
  };

  const toggleEditMode = () => {
    const newEditMode = !editMode;
    setEditMode(newEditMode);
    
    if (newEditMode) {
      window.history.pushState({}, '', '?edit=true');
    } else {
      window.history.pushState({}, '', window.location.pathname);
      toast.success('Layout locked');
    }
  };

  const getAppAtPosition = (row, col) => {
    const appId = Object.entries(appPositions).find(
      ([id, pos]) => pos.row === row && pos.col === col
    )?.[0];
    
    return defaultApps.find(app => app.id === appId);
  };

  // Removed wallpaper logic: ensure it falls back to a valid URL

  console.log('Dashboard rendering with positions:', appPositions);
  console.log('Number of positioned apps:', Object.keys(appPositions).length);

  return (
    <div 
      className="h-full relative overflow-hidden bg-cover bg-center bg-no-repeat"
      // Removed inline background style - now handled in Layout
    >
      {/* Edit Mode Indicator */}
      <AnimatePresence>
        {editMode && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="bg-white/90 text-gray-800 px-4 py-2 rounded-full shadow-lg flex items-center gap-2 font-medium">
              <Unlock className="w-4 h-4" />
              Edit Mode - Drag icons to rearrange
              <Button
                size="sm"
                variant="ghost"
                onClick={toggleEditMode}
                className="ml-2 h-6 bg-gray-700 hover:bg-gray-800 text-white"
              >
                Done
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Grid */}
      <div className="absolute inset-0 p-8 z-10">
        <div className="grid gap-4" style={{
          gridTemplateColumns: `repeat(${COLS}, 140px)`,
          gridTemplateRows: `repeat(${ROWS}, 140px)`
        }}>
          {Array.from({ length: ROWS }, (_, row) =>
            Array.from({ length: COLS }, (_, col) => {
              const app = getAppAtPosition(row, col);
              
              return (
                <div
                  key={`${row}-${col}`}
                  className={`relative ${editMode ? 'border-2 border-dashed border-white/30 rounded-xl bg-white/5' : ''}`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, row, col)}
                >
                  {app && (
                    <div
                      draggable={editMode}
                      onDragStart={(e) => handleDragStart(e, app)}
                      className={`h-full ${editMode ? 'cursor-move' : ''}`}
                    >
                      {editMode ? (
                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          className="flex flex-col items-center justify-center gap-3 h-full p-4 rounded-lg bg-white/10 backdrop-blur-sm"
                        >
                          <div className={`w-16 h-16 bg-gradient-to-br ${app.color} rounded-2xl shadow-2xl flex items-center justify-center`}>
                            <app.icon className="w-8 h-8 text-white" />
                          </div>
                          <span className="text-white text-sm font-medium text-center drop-shadow-lg leading-tight">
                            {app.name}
                          </span>
                        </motion.div>
                      ) : (
                        // Conditional rendering for mailto links vs internal links
                        app.path.startsWith("mailto:") ? (
                          <a href={app.path} className="block h-full" target="_blank" rel="noopener noreferrer">
                            <motion.div
                              whileHover={{ scale: 1.05 }}
                              className="flex flex-col items-center justify-center gap-3 h-full p-4 rounded-lg hover:bg-white/10 backdrop-blur-sm transition-all"
                            >
                              <div className={`w-16 h-16 bg-gradient-to-br ${app.color} rounded-2xl shadow-2xl flex items-center justify-center`}>
                                <app.icon className="w-8 h-8 text-white" />
                              </div>
                              <span className="text-white text-sm font-medium text-center drop-shadow-lg leading-tight">
                                {app.name}
                              </span>
                            </motion.div>
                          </a>
                        ) : (
                          <Link to={createPageUrl(app.path)} className="block h-full">
                            <motion.div
                              whileHover={{ scale: 1.05 }}
                              className="flex flex-col items-center justify-center gap-3 h-full p-4 rounded-lg hover:bg-white/10 backdrop-blur-sm transition-all"
                            >
                              <div className={`w-16 h-16 bg-gradient-to-br ${app.color} rounded-2xl shadow-2xl flex items-center justify-center`}>
                                <app.icon className="w-8 h-8 text-white" />
                              </div>
                              <span className="text-white text-sm font-medium text-center drop-shadow-lg leading-tight">
                                {app.name}
                              </span>
                            </motion.div>
                          </Link>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Desktop Shortcuts - Right Side (Keeping existing as 'unnecessary sections' was not specific) */}
      <div className="absolute right-8 top-8 space-y-4 z-40">
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
  );
}
