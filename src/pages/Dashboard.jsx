import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
  UtensilsCrossed,
  Users,
  Settings,
  ListChecks,
  ClipboardCheck,
  Video,
  CalendarIcon,
  Building2,
  MessageSquare,
  Ticket,
  Folder
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

const defaultApps = [
  { id: "mytasks", name: "Tasks", icon: ListChecks, color: "from-blue-500 to-indigo-500", path: "MyTasks" },
  { id: "mymeetings", name: "My Meetings", icon: Video, color: "from-purple-500 to-pink-500", path: "MyMeetings" },
  { id: "myapprovals", name: "Approvals", icon: ClipboardCheck, color: "from-orange-500 to-red-500", path: "MyApprovals", showBadge: true },
  { id: "calendar", name: "Church Calendar", icon: CalendarIcon, color: "from-blue-600 to-cyan-500", path: "Calendar" },
  { id: "communications", name: "Communications Request", icon: MessageSquare, color: "from-purple-500 to-pink-500", path: "WorkflowHub" },
  { id: "foodservice", name: "Hospitality", icon: UtensilsCrossed, color: "from-green-500 to-emerald-500", path: "FoodService" },
  { id: "staffdir", name: "Directory", icon: Users, color: "from-teal-500 to-cyan-500", path: "StaffDirectory" },
  { id: "mydepartment", name: "My Department", icon: Building2, color: "from-violet-500 to-purple-600", path: "MyDepartment" },
  { id: "documents", name: "Documents", icon: Folder, color: "from-sky-500 to-blue-500", path: "Documents" },
  { id: "support", name: "Support Requests", icon: Ticket, color: "from-amber-500 to-yellow-500", path: "Ticketing" },
  { id: "settings", name: "Settings", icon: Settings, color: "from-slate-500 to-slate-600", path: "Settings" }
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
    mymeetings: { row: 0, col: 1 },
    myapprovals: { row: 0, col: 2 },
    calendar: { row: 0, col: 3 },
    communications: { row: 1, col: 0 },
    foodservice: { row: 1, col: 1 },
    staffdir: { row: 1, col: 2 },
    mydepartment: { row: 1, col: 3 },
    documents: { row: 2, col: 0 },
    support: { row: 2, col: 1 },
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
  const [tasksDueToday, setTasksDueToday] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadUser();
    loadApprovals();
    loadTasksDueToday();
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
    } finally {
      setIsLoading(false);
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

  const loadTasksDueToday = async () => {
    try {
      const currentUser = await base44.auth.me();
      
      let todayCount = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      if (currentUser?.clickup_access_token) {
        try {
          const clickupResponse = await base44.functions.invoke('getMyClickUpTasks');
          const clickupTasks = clickupResponse.data.tasks || [];
          
          const clickupDueToday = clickupTasks.filter(task => {
            if (!task.due_date) return false;
            const dueDate = new Date(task.due_date);
            return dueDate >= today && dueDate < tomorrow;
          });
          
          todayCount += clickupDueToday.length;
        } catch (error) {
          console.error('Failed to load ClickUp tasks:', error);
        }
      }

      if (currentUser?.microsoft_access_token) {
        try {
          const todoResponse = await base44.functions.invoke('getMicrosoftToDo');
          const todoTasks = todoResponse.data.tasks || todoResponse.data || [];
          
          const todoDueToday = todoTasks.filter(task => {
            if (!task.due_date) return false;
            const dueDate = new Date(task.due_date);
            return dueDate >= today && dueDate < tomorrow;
          });
          
          todayCount += todoDueToday.length;
        } catch (error) {
          console.error('Failed to load Microsoft To Do tasks:', error);
        }
      }

      setTasksDueToday(todayCount);
    } catch (error) {
      console.error('Failed to load tasks due today:', error);
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

  // Show loading briefly to avoid glitches
  if (isLoading) {
    return (
      <div 
        className="h-full relative overflow-hidden bg-cover bg-center bg-no-repeat flex items-center justify-center"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.3)), url('${wallpaperUrl}')`
        }}
      >
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div 
      className="h-full relative overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.3)), url('${wallpaperUrl}')`
      }}
    >
      <style>{`
        .fbca-logo-taskbar {
          filter: drop-shadow(0 2px 4px rgba(59, 130, 246, 0.4));
        }
      `}</style>

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
                            {app.id === 'myapprovals' && approvalsCount > 0 && (
                              <Badge className="absolute -top-2 -right-2 bg-red-500 text-white border-2 border-white min-w-[24px] h-6 flex items-center justify-center px-1.5">
                                {approvalsCount}
                              </Badge>
                            )}
                            {app.id === 'mytasks' && tasksDueToday > 0 && (
                              <Badge className="absolute -top-2 -right-2 bg-blue-500 text-white border-2 border-white min-w-[24px] h-6 flex items-center justify-center px-1.5">
                                {tasksDueToday}
                              </Badge>
                            )}
                          </div>
                          <span className="text-white text-sm font-medium text-center drop-shadow-lg leading-tight">
                            {app.name}
                          </span>
                        </motion.div>
                      ) : (
                        <Link to={createPageUrl(app.path)} className="block h-full">
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            className="flex flex-col items-center justify-center gap-3 h-full p-4 rounded-lg bg-white/10 backdrop-blur-sm transition-all"
                          >
                            <div className={`w-16 h-16 bg-gradient-to-br ${app.color} rounded-2xl shadow-2xl flex items-center justify-center relative`}>
                              <app.icon className="w-8 h-8 text-white" />
                              {app.id === 'myapprovals' && approvalsCount > 0 && (
                                <Badge className="absolute -top-2 -right-2 bg-red-500 text-white border-2 border-white min-w-[24px] h-6 flex items-center justify-center px-1.5">
                                  {approvalsCount}
                                </Badge>
                              )}
                              {app.id === 'mytasks' && tasksDueToday > 0 && (
                                <Badge className="absolute -top-2 -right-2 bg-blue-500 text-white border-2 border-white min-w-[24px] h-6 flex items-center justify-center px-1.5">
                                  {tasksDueToday}
                                </Badge>
                              )}
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
    </div>
  );
}