import React, { useState, useEffect, useRef } from "react";
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
  GripVertical,
  Image as ImageIcon
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

// Create default positions for all apps (free positioning)
const createDefaultPositions = () => {
  const positions = {};
  defaultApps.forEach((app, index) => {
    const row = Math.floor(index / 2);
    const col = index % 2;
    positions[app.id] = {
      x: 50 + (col * 150),
      y: 50 + (row * 130)
    };
  });
  return positions;
};

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [apps] = useState(defaultApps);
  const [wallpaper, setWallpaper] = useState("cross_white_glow");
  const [editMode, setEditMode] = useState(false);
  const [appPositions, setAppPositions] = useState(createDefaultPositions());
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [draggingApp, setDraggingApp] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      // Load custom wallpaper
      if (currentUser.wallpaper) {
        setWallpaper(currentUser.wallpaper);
      }
      
      // Load custom desktop layout with free positions
      if (currentUser.desktop_layout && Array.isArray(currentUser.desktop_layout) && currentUser.desktop_layout.length > 0) {
        const positions = {};
        currentUser.desktop_layout.forEach(item => {
          if (item.x !== undefined && item.y !== undefined) {
            positions[item.id] = { x: item.x, y: item.y };
          }
        });
        if (Object.keys(positions).length > 0) {
          setAppPositions(positions);
        }
      }
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const handleMouseDown = (e, app) => {
    if (!editMode) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = e.currentTarget.getBoundingClientRect();
    setDraggingApp(app.id);
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseMove = (e) => {
    if (!draggingApp || !editMode || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const newX = e.clientX - containerRect.left - dragOffset.x;
    const newY = e.clientY - containerRect.top - dragOffset.y;
    
    // Keep within bounds
    const boundedX = Math.max(10, Math.min(newX, containerRect.width - 110));
    const boundedY = Math.max(10, Math.min(newY, containerRect.height - 110));
    
    setAppPositions(prev => ({
      ...prev,
      [draggingApp]: { x: boundedX, y: boundedY }
    }));
  };

  const handleMouseUp = async () => {
    if (draggingApp && editMode) {
      await saveLayout(appPositions);
      setDraggingApp(null);
    }
  };

  const saveLayout = async (positions) => {
    try {
      const layout = Object.entries(positions).map(([id, pos]) => ({
        id,
        x: pos.x,
        y: pos.y
      }));
      
      await base44.auth.updateMe({ desktop_layout: layout });
    } catch (error) {
      console.error("Error saving layout:", error);
      toast.error("Failed to save layout");
    }
  };

  const toggleEditMode = () => {
    setEditMode(!editMode);
    if (editMode) {
      toast.success('Layout locked');
      setDraggingApp(null);
    } else {
      toast.info('Edit mode: Click and drag icons to move them');
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

  const wallpaperUrl = wallpapers[wallpaper] || wallpapers.cross_white_glow;

  return (
    <div 
      ref={containerRef}
      className="h-full relative overflow-hidden select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Desktop Background with Right-Click Menu */}
      <ContextMenu>
        <ContextMenuTrigger className="absolute inset-0">
          <div
            className="w-full h-full bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600"
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
            <GripVertical className="w-4 h-4 mr-2" />
            {editMode ? 'Lock Icons' : 'Rearrange Icons'}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setShowWallpaperPicker(true)}>
            <ImageIcon className="w-4 h-4 mr-2" />
            Change Wallpaper
          </ContextMenuItem>
          <ContextMenuItem>
            <Grid3x3 className="w-4 h-4 mr-2" />
            View Options
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

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

      {/* Edit Mode Indicator */}
      {editMode && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="bg-blue-600/90 backdrop-blur-lg text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3">
            <GripVertical className="w-5 h-5 animate-pulse" />
            <span className="font-medium">Edit Mode: Click and drag icons to move them</span>
            <button
              onClick={toggleEditMode}
              className="ml-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-sm transition-colors"
            >
              Done
            </button>
          </div>
        </motion.div>
      )}

      {/* Desktop Apps - Free Positioning */}
      <div className="absolute inset-0 pointer-events-none">
        {apps.map((app) => {
          const pos = appPositions[app.id] || { x: 50, y: 50 };
          
          return (
            <motion.div
              key={app.id}
              style={{
                position: 'absolute',
                left: pos.x,
                top: pos.y,
                pointerEvents: 'auto'
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={editMode ? {} : { scale: 1.05 }}
              onMouseDown={(e) => handleMouseDown(e, app)}
              className={`${editMode ? 'cursor-move' : 'cursor-pointer'}`}
            >
              <Link 
                to={createPageUrl(app.path)} 
                onClick={(e) => editMode && e.preventDefault()}
                className="pointer-events-auto"
              >
                <div className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-all w-24 ${
                  editMode ? 'bg-white/10 backdrop-blur-sm ring-2 ring-white/30' : 'hover:bg-white/10 backdrop-blur-sm'
                }`}>
                  <div className={`w-16 h-16 bg-gradient-to-br ${app.color} rounded-2xl shadow-2xl flex items-center justify-center transition-shadow relative`}>
                    <app.icon className="w-8 h-8 text-white" />
                    {editMode && (
                      <GripVertical className="absolute -top-2 -right-2 w-5 h-5 text-white bg-blue-600 rounded-full p-0.5" />
                    )}
                  </div>
                  <span className="text-white text-xs font-medium text-center drop-shadow-lg leading-tight">
                    {app.name}
                  </span>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Desktop Shortcuts - Right Side */}
      <div className="absolute right-8 top-8 space-y-4 z-40 pointer-events-auto">
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