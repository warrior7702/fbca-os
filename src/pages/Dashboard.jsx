import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
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
  GripVertical
} from "lucide-react";
import { motion } from "framer-motion";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { toast } from "sonner";

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
  const [apps, setApps] = useState(defaultApps);
  const [wallpaper, setWallpaper] = useState("church_steeple_night");

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
      
      // Load custom desktop layout
      if (currentUser.desktop_layout && Array.isArray(currentUser.desktop_layout)) {
        const customLayout = currentUser.desktop_layout.map(item => {
          const app = defaultApps.find(a => a.id === item.id);
          return app;
        }).filter(Boolean);
        
        // Add any new apps that weren't in the saved layout
        const savedIds = currentUser.desktop_layout.map(i => i.id);
        const newApps = defaultApps.filter(a => !savedIds.includes(a.id));
        
        setApps([...customLayout, ...newApps]);
      }
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    
    const items = Array.from(apps);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setApps(items);
    
    // Save layout
    try {
      const layout = items.map((app, index) => ({
        id: app.id,
        position: index
      }));
      
      await base44.auth.updateMe({ desktop_layout: layout });
      toast.success("Desktop layout saved");
    } catch (error) {
      console.error("Error saving layout:", error);
      toast.error("Failed to save layout");
    }
  };

  const wallpaperUrl = wallpapers[wallpaper] || wallpapers.church_steeple_night;

  return (
    <div className="h-full relative overflow-hidden">
      {/* Desktop Background */}
      <ContextMenu>
        <ContextMenuTrigger>
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

      {/* Desktop Icons - Draggable Grid */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="desktop" direction="vertical">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="relative h-full p-8"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, 120px)',
                gridAutoRows: '120px',
                gap: '20px',
                alignContent: 'start'
              }}
            >
              {apps.map((app, index) => (
                <Draggable key={app.id} draggableId={app.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      style={{
                        ...provided.draggableProps.style,
                        opacity: snapshot.isDragging ? 0.5 : 1
                      }}
                    >
                      <Link to={createPageUrl(app.path)}>
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.05 }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-all cursor-move ${
                            snapshot.isDragging ? 'bg-white/30 backdrop-blur-lg' : 'hover:bg-white/10 backdrop-blur-sm'
                          }`}
                        >
                          <div className={`w-16 h-16 bg-gradient-to-br ${app.color} rounded-2xl shadow-2xl flex items-center justify-center group-hover:shadow-3xl transition-shadow relative`}>
                            <app.icon className="w-8 h-8 text-white" />
                            {snapshot.isDragging && (
                              <GripVertical className="absolute -top-2 -right-2 w-5 h-5 text-white/70" />
                            )}
                          </div>
                          <span className="text-white text-sm font-medium text-center drop-shadow-lg leading-tight">
                            {app.name}
                          </span>
                        </motion.div>
                      </Link>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Desktop Shortcuts - Right Side (Static) */}
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
  );
}