import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard,
  Megaphone,
  UtensilsCrossed,
  User,
  Bell,
  Search,
  Settings,
  LogOut,
  ChevronDown,
  Command,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const apps = [
  {
    name: "Dashboard",
    path: "Dashboard",
    icon: LayoutDashboard,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10"
  },
  {
    name: "Marketing",
    path: "Marketing",
    icon: Megaphone,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10"
  },
  {
    name: "Food Service",
    path: "FoodService",
    icon: UtensilsCrossed,
    color: "text-green-500",
    bgColor: "bg-green-500/10"
  },
  {
    name: "FBCA Nexts",
    path: "FBCANexts",
    icon: User,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10"
  }
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = () => {
    base44.auth.logout();
  };

  const filteredApps = apps.filter(app =>
    app.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-3">
          {/* Logo and Brand */}
          <div className="flex items-center gap-4">
            <Link to={createPageUrl("Dashboard")} className="flex items-center gap-3 group">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                  <span className="text-white font-bold text-sm">FB44</span>
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">FBCA OS</h1>
                <p className="text-xs text-slate-500">v1.0</p>
              </div>
            </Link>

            {/* App Switcher */}
            <div className="hidden lg:flex items-center gap-2 ml-8">
              {apps.map((app) => {
                const isActive = location.pathname === createPageUrl(app.path);
                return (
                  <Link
                    key={app.name}
                    to={createPageUrl(app.path)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      isActive
                        ? `${app.bgColor} ${app.color} font-medium`
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <app.icon className="w-4 h-4" />
                    <span className="text-sm">{app.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-3">
            {/* Command Palette Trigger */}
            <Button
              variant="outline"
              onClick={() => setShowCommandPalette(true)}
              className="hidden md:flex items-center gap-2 text-slate-600"
            >
              <Search className="w-4 h-4" />
              <span className="text-sm">Search</span>
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-slate-100 px-1.5 font-mono text-xs text-slate-600">
                <Command className="w-3 h-3" />K
              </kbd>
            </Button>

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="w-5 h-5 text-slate-600" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="font-semibold">Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="p-4 text-center text-sm text-slate-500">
                  No new notifications
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {user?.full_name?.[0]?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-medium text-slate-900">{user?.full_name || 'User'}</p>
                    <p className="text-xs text-slate-500 capitalize">{user?.role || 'Member'}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div>
                    <p className="font-medium">{user?.full_name || 'User'}</p>
                    <p className="text-xs text-slate-500 font-normal">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="min-h-[calc(100vh-73px)]">
        {children}
      </main>

      {/* Command Palette */}
      <Dialog open={showCommandPalette} onOpenChange={setShowCommandPalette}>
        <DialogContent className="sm:max-w-2xl p-0">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Search className="w-4 h-4" />
              Quick Search
            </DialogTitle>
          </DialogHeader>
          <div className="px-4 pb-2">
            <Input
              placeholder="Search apps, features, or commands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-0 focus-visible:ring-0 text-base"
              autoFocus
            />
          </div>
          <div className="border-t max-h-96 overflow-y-auto">
            {filteredApps.length > 0 ? (
              <div className="p-2">
                {filteredApps.map((app) => (
                  <Link
                    key={app.name}
                    to={createPageUrl(app.path)}
                    onClick={() => setShowCommandPalette(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <div className={`p-2 rounded-lg ${app.bgColor}`}>
                      <app.icon className={`w-5 h-5 ${app.color}`} />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{app.name}</p>
                      <p className="text-xs text-slate-500">Navigate to {app.name}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500">
                No results found
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Base 44 Badge */}
      <div className="fixed bottom-4 right-4 z-50">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-full shadow-lg text-xs text-slate-600">
          <Layers className="w-3 h-3 text-blue-500" />
          <span className="font-medium">Powered by Base 44</span>
        </div>
      </div>
    </div>
  );
}