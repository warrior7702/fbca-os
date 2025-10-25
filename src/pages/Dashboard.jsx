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
  ImageIcon
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

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [wallpaper, setWallpaper] = useState("cross_white_glow");
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);

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
    } catch (error) {
      console.error("Error loading user:", error);
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

      {/* Desktop Apps Grid */}
      <div className="absolute inset-0 p-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 content-start">
        {defaultApps.map((app, index) => (
          <Link key={app.id} to={createPageUrl(app.path)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              className="flex flex-col items-center gap-3 p-4 rounded-lg hover:bg-white/10 backdrop-blur-sm transition-all"
            >
              <div className={`w-16 h-16 bg-gradient-to-br ${app.color} rounded-2xl shadow-2xl flex items-center justify-center transition-shadow`}>
                <app.icon className="w-8 h-8 text-white" />
              </div>
              <span className="text-white text-sm font-medium text-center drop-shadow-lg leading-tight">
                {app.name}
              </span>
            </motion.div>
          </Link>
        ))}
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