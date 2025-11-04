
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
  Mail,
  Ticket,
  Building2,
  Inbox,
  Video,
  CalendarIcon
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const defaultApps = [
  { id: "mytasks", name: "Tasks", icon: ListChecks, color: "from-blue-500 to-indigo-500", path: "MyTasks" },
  { id: "myapprovals", name: "Approvals", icon: ClipboardCheck, color: "from-orange-500 to-red-500", path: "MyApprovals", showBadge: true },
  { id: "mydepartment", name: "My Department", icon: Building2, color: "from-violet-500 to-purple-600", path: "MyDepartment" },
  { id: "marketing", name: "Marketing", icon: Megaphone, color: "from-purple-500 to-pink-500", path: "Marketing" },
  { id: "foodservice", name: "Hospitality", icon: UtensilsCrossed, color: "from-green-500 to-emerald-500", path: "FoodService" },
  { id: "staffdir", name: "Directory", icon: Users, color: "from-teal-500 to-cyan-500", path: "StaffDirectory" },
  { id: "settings", name: "Settings", icon: Settings, color: "from-slate-500 to-slate-600", path: "Settings" },
  { id: "email", name: "Email", icon: Mail, color: "from-blue-600 to-sky-400", path: "mailto:" },
  { id: "ticketing", name: "Ticketing", icon: Ticket, color: "from-amber-500 to-yellow-500", path: "Ticketing" },
  { id: "inboxhelper", name: "Inbox Helper", icon: Inbox, color: "from-rose-500 to-pink-600", path: "InboxHelper" },
  { id: "mymeetings", name: "My Meetings", icon: Video, color: "from-cyan-500 to-blue-600", path: "MyMeetings" }
];

const wallpapers = {
  church_steeple_night: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fb9a0b2d7d369a37662cca/c4c5d5f09_ChatGPTImageOct25202502_23_44AM.png",
  church_building_blue: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fb9a0b2d7d369a37662cca/3e3148244_ChatGPTImageOct25202502_24_10AM.png",
  cross_chrome_blue: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fb9a0b2d7d369a37662cca/ad26483c6_ChatGPTImageOct25202502_25_20AM.png",
  cross_white_glow: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fb9a0b2d7d369a37662cca/a221e8e71_ChatGPTImageOct25202502_30_15AM.png",
  cross_metal_texture: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fb9a0b2d7d369a37662cca/dcac8ecf7_ChatGPTImageOct25202502_35_35AM.png"
};

const COLS = 8;
const ROWS = 6;

const getDefaultPositions = () => {
  return {
    mytasks: { row: 0, col: 0 },
    myapprovals: { row: 0, col: 1 },
    mydepartment: { row: 0, col: 2 }, // Updated position
    email: { row: 0, col: 3 }, // Updated position
    marketing: { row: 1, col: 0 },
    foodservice: { row: 1, col: 1 },
    staffdir: { row: 1, col: 2 },
    ticketing: { row: 2, col: 0 },
    inboxhelper: { row: 2, col: 1 }, // Updated position
    mymeetings: { row: 3, col: 0 },
    settings: { row: 5, col: 0 }
  };
};

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [wallpaper, setWallpaper] = useState("cross_white_glow");
  const [editMode, setEditMode] = useState(false);
  const [appPositions, setAppPositions] = useState(getDefaultPositions());
  const [draggedApp, setDraggedApp] = useState(null);
  const [approvalsCount, setApprovalsCount] = useState(0);

  useEffect(() => {
    loadUser();
    loadApprovals();
  }, []);

  useEffect(() => {
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
      
      if (currentUser.wallpaper) {
        setWallpaper(currentUser.wallpaper);
      }
      
      let layout = currentUser.desktop_layout;
      
      const defaultPositions = getDefaultPositions();
      
      if (!layout || Array.isArray(layout) || typeof layout !== 'object') {
        setAppPositions(defaultPositions);
        
        try {
          await base44.auth.updateMe({ desktop_layout: defaultPositions });
        } catch (error) {
          console.error('Failed to repair layout:', error);
        }
      } else {
        const mergedPositions = { ...defaultPositions };
        
        Object.keys(layout).forEach(appId => {
          if (defaultApps.find(app => app.id === appId)) {
            mergedPositions[appId] = layout[appId];
          }
        });
        
        setAppPositions(mergedPositions);
        
        if (Object.keys(mergedPositions).length !== Object.keys(layout).length) {
          try {
            await base44.auth.updateMe({ desktop_layout: mergedPositions });
          } catch (error) {
            console.error('Failed to update layout:', error);
          }
        }
      }
    } catch (error) {
      console.error("Error loading user:", error);
      setAppPositions(getDefaultPositions());
    }
  };

  const loadApprovals = async () => {
    try {
      const response = await base44.functions.invoke('getMyPendingApprovals');
      setApprovalsCount(response.data?.count || 0);
    } catch (error) {
      console.error('Failed to load approvals count:', error);
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

  const wallpaperUrl = wallpapers[wallpaper] || wallpapers.cross_white_glow;

  return (
    <div 
      className="h-full relative overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.3)), url('${wallpaperUrl}')`
      }}
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
                          <div className={`w-16 h-16 bg-gradient-to-br ${app.color} rounded-2xl shadow-2xl flex items-center justify-center relative`}>
                            <app.icon className="w-8 h-8 text-white" />
                            {app.showBadge && approvalsCount > 0 && (
                              <Badge className="absolute -top-2 -right-2 bg-red-500 text-white border-2 border-white min-w-[24px] h-6 flex items-center justify-center px-1.5">
                                {approvalsCount}
                              </Badge>
                            )}
                          </div>
                          <span className="text-white text-sm font-medium text-center drop-shadow-lg leading-tight">
                            {app.name}
                          </span>
                        </motion.div>
                      ) : (
                        app.path.startsWith("mailto:") ? (
                          <a href={app.path} className="block h-full" target="_blank" rel="noopener noreferrer">
                            <motion.div
                              whileHover={{ scale: 1.05 }}
                              className="flex flex-col items-center justify-center gap-3 h-full p-4 rounded-lg bg-white/10 backdrop-blur-sm transition-all"
                            >
                              <div className={`w-16 h-16 bg-gradient-to-br ${app.color} rounded-2xl shadow-2xl flex items-center justify-center relative`}>
                                <app.icon className="w-8 h-8 text-white" />
                                {app.showBadge && approvalsCount > 0 && (
                                  <Badge className="absolute -top-2 -right-2 bg-red-500 text-white border-2 border-white min-w-[24px] h-6 flex items-center justify-center px-1.5">
                                    {approvalsCount}
                                  </Badge>
                                )}
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
                              className="flex flex-col items-center justify-center gap-3 h-full p-4 rounded-lg bg-white/10 backdrop-blur-sm transition-all"
                            >
                              <div className={`w-16 h-16 bg-gradient-to-br ${app.color} rounded-2xl shadow-2xl flex items-center justify-center relative`}>
                                <app.icon className="w-8 h-8 text-white" />
                                {app.showBadge && approvalsCount > 0 && (
                                  <Badge className="absolute -top-2 -right-2 bg-red-500 text-white border-2 border-white min-w-[24px] h-6 flex items-center justify-center px-1.5">
                                    {approvalsCount}
                                  </Badge>
                                )}
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
