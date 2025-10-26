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
  Users,
  CheckSquare,
  ImageIcon,
  Lock,
  Unlock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const defaultApps = [
  { id: "mytasks", name: "My Tasks", icon: CheckSquare, color: "from-blue-500 to-indigo-500", path: "MyTasks" },
  { id: "myapprovals", name: "My Approvals", icon: CheckSquare, color: "from-orange-500 to-red-500", path: "MyApprovals" },
  { id: "marketing", name: "Marketing", icon: Megaphone, color: "from-purple-500 to-pink-500", path: "Marketing" },
  { id: "foodservice", name: "Food Service", icon: UtensilsCrossed, color: "from-green-500 to-emerald-500", path: "FoodService" },
  { id: "staffdir", name: "Staff Directory", icon: Users, color: "from-teal-500 to-cyan-500", path: "StaffDirectory" },
  { id: "settings", name: "Settings", icon: Settings, color: "from-slate-500 to-slate-600", path: "Settings" }
];

const wallpapers = {
  church_steeple_night: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fb9a0b2d7d369a37662cca/c4c5d5f09_ChatGPTImageOct25202502_23_44AM.png",
  church_building_blue: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fb9a0b2d7d369a37662cca/3e3148244_ChatGPTImageOct25202502_24_10AM.png",
  cross_chrome_blue: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fb9a0b2d7d369a37662cca/ad26483c6_ChatGPTImageOct25202502_25_20AM.png",
  cross_white_glow: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fb9a0b2d7d369a37662cca/a221e8e71_ChatGPTImageOct25202502_30_15AM.png",
  cross_metal_texture: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fb9a0b2d7d369a37662cca/dcac8ecf7_ChatGPTImageOct25202502_35_35AM.png"
};

// Grid configuration
const COLS = 6;
const ROWS = 4;

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [wallpaper, setWallpaper] = useState("cross_white_glow");
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [appPositions, setAppPositions] = useState({});
  const [draggedApp, setDraggedApp] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      if (currentUser.wallpaper) {
        setWallpaper(currentUser.wallpaper);
      }
      
      // Load saved positions or set defaults
      if (currentUser.desktop_layout && typeof currentUser.desktop_layout === 'object') {
        setAppPositions(currentUser.desktop_layout);
      } else {
        // Default positions - 2 columns
        const defaultPositions = {};
        defaultApps.forEach((app, index) => {
          defaultPositions[app.id] = {
            row: Math.floor(index / 2),
            col: index % 2
          };
        });
        setAppPositions(defaultPositions);
      }
    } catch (error) {
      console.error("Error loading user:", error);
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

    // Check if spot is occupied
    const occupied = Object.entries(appPositions).find(
      ([id, pos]) => id !== draggedApp.id && pos.row === row && pos.col === col
    );

    if (occupied) {
      toast.error('Spot already taken!');
      setDraggedApp(null);
      return;
    }

    // Update position
    const newPositions = {
      ...appPositions,
      [draggedApp.id]: { row, col }
    };
    
    setAppPositions(newPositions);
    setDraggedApp(null);
    
    // Save to database
    try {
      await base44.auth.updateMe({ desktop_layout: newPositions });
      toast.success('Icon moved!');
    } catch (error) {
      console.error("Error saving layout:", error);
      toast.error('Failed to save layout');
    }
  };

  const toggleEditMode = () => {
    setEditMode(!editMode);
    if (!editMode) {
      toast.info('Drag icons to rearrange');
    } else {
      toast.success('Layout locked');
    }
  };

  const handleWallpaperChange = async (wallpaperId) => {
    setWallpaper(wallpaperId);
    try {
      await base44.auth.updateMe({ wallpaper: wallpaperId });
      toast.success("Wallpaper updated!");
      setShowWallpaperPicker(false);
    } catch (error) {
      console.error("Error updating wallpaper:", error);
      toast.error("Failed to update wallpaper");
    }
  };

  const getAppAtPosition = (row, col) => {
    const appId = Object.entries(appPositions).find(
      ([id, pos]) => pos.row === row && pos.col === col
    )?.[0];
    
    return defaultApps.find(app => app.id === appId);
  };

  const wallpaperUrl = wallpapers[wallpaper] || wallpapers.cross_white_glow;

  return (
    <div className="h-full relative overflow-hidden">
      {/* Desktop Background with Right-Click Menu */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600"
            style={{
              backgroundImage: `url('${wallpaperUrl}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            <div className="absolute inset-0 bg-black/20" />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={toggleEditMode}>
            {editMode ? <Lock className="w-4 h-4 mr-2" /> : <Unlock className="w-4 h-4 mr-2" />}
            {editMode ? 'Lock Icons' : 'Rearrange Icons'}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setShowWallpaperPicker(true)}>
            <ImageIcon className="w-4 h-4 mr-2" />
            Change Wallpaper
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Edit Mode Indicator */}
      <AnimatePresence>
        {editMode && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="bg-yellow-500 text-yellow-900 px-4 py-2 rounded-full shadow-lg flex items-center gap-2 font-medium">
              <Unlock className="w-4 h-4" />
              Edit Mode - Drag icons to rearrange
              <Button
                size="sm"
                variant="ghost"
                onClick={toggleEditMode}
                className="ml-2 h-6 bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                Done
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wallpaper Picker Modal */}
      <Dialog open={showWallpaperPicker} onOpenChange={setShowWallpaperPicker}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Choose Wallpaper</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
            {Object.entries(wallpapers).map(([id, url]) => {
              const wallpaperInfo = [
                { id: "church_steeple_night", name: "Church Steeple Night" },
                { id: "church_building_blue", name: "Church Building Blue" },
                { id: "cross_chrome_blue", name: "Cross Chrome Blue" },
                { id: "cross_white_glow", name: "Cross White Glow" },
                { id: "cross_metal_texture", name: "Cross Metal Texture" }
              ].find(w => w.id === id);

              return (
                <motion.div
                  key={id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`relative cursor-pointer rounded-lg overflow-hidden border-4 transition-all ${
                    wallpaper === id
                      ? 'border-blue-600 shadow-lg ring-2 ring-blue-300'
                      : 'border-transparent hover:border-slate-300'
                  }`}
                  onClick={() => handleWallpaperChange(id)}
                >
                  <img
                    src={url}
                    alt={wallpaperInfo?.name || id}
                    className="w-full h-40 object-cover"
                  />
                  {wallpaper === id && (
                    <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full p-1">
                      <CheckSquare className="w-4 h-4" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                    <p className="text-white text-sm font-medium">{wallpaperInfo?.name || id}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Desktop Grid */}
      <div className="absolute inset-0 p-8">
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
                  className={`relative ${editMode ? 'border-2 border-dashed border-white/20 rounded-xl' : ''}`}
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
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Desktop Shortcuts - Right Side */}
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