
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Settings as SettingsIcon, User, Bell, Lock, Palette, Info, Link as LinkIcon, Image, Mail } from "lucide-react"; // Added Mail import
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import ConnectionStatusCard from "../components/settings/ConnectionStatusCard";
import { Calendar, CheckSquare, Briefcase } from "lucide-react";
import { motion } from "framer-motion"; // Added framer-motion import
import { useNavigate } from "react-router-dom"; // Added useNavigate for navigation

const wallpapers = [
  {
    id: "church_steeple_night",
    name: "Church Steeple Night",
    url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fb9a0b2d7d369a37662cca/c4c5d5f09_ChatGPTImageOct25202502_23_44AM.png"
  },
  {
    id: "church_building_blue",
    name: "Church Building Blue",
    url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fb9a0b2d7d369a37662cca/3e3148244_ChatGPTImageOct25202502_24_10AM.png"
  },
  {
    id: "cross_chrome_blue",
    name: "Cross Chrome Blue",
    url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fb9a0b2d7d369a37662cca/ad26483c6_ChatGPTImageOct25202502_25_20AM.png"
  },
  {
    id: "cross_white_glow",
    name: "Cross White Glow",
    url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fb9a0b2d7d369a37662cca/a221e8e71_ChatGPTImageOct25202502_30_15AM.png"
  },
  {
    id: "cross_metal_texture",
    name: "Cross Metal Texture",
    url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fb9a0b2d7d369a37662cca/dcac8ecf7_ChatGPTImageOct25202502_35_35AM.png"
  }
];

export default function Settings() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [department, setDepartment] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [selectedWallpaper, setSelectedWallpaper] = useState("cross_white_glow"); // Changed default wallpaper
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  const navigate = useNavigate(); // Initialize useNavigate hook

  useEffect(() => {
    loadUser();
    
    // Check for OAuth callback success/error messages OR direct tab navigation
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    
    // If there's a tab param or OAuth callback, switch tabs accordingly
    if (tabParam) {
      setActiveTab(tabParam);
    } else if (urlParams.get('connected') || urlParams.get('error')) {
      setActiveTab('integrations');
      
      if (urlParams.get('connected') === 'pco') {
        toast.success('Planning Center connected successfully!');
      } else if (urlParams.get('connected') === 'clickup') {
        toast.success('ClickUp connected successfully!');
      } else if (urlParams.get('connected') === 'microsoft') {
        toast.success('Microsoft 365 connected successfully!');
      } else if (urlParams.get('error')) {
        toast.error('Connection failed. Please try again.');
      }
      
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setDisplayName(currentUser.display_name || "");
      setDepartment(currentUser.department || "");
      setRoleTitle(currentUser.role_title || "");
      setSelectedWallpaper(currentUser.wallpaper || "cross_white_glow"); // Load user's wallpaper preference, updated default
    } catch (error) {
      console.error("Error loading user:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({
        display_name: displayName,
        department: department,
        role_title: roleTitle
      });
      toast.success("Profile updated successfully");
      loadUser();
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleWallpaperChange = async (wallpaperId) => {
    setSelectedWallpaper(wallpaperId);
    try {
      // Only update wallpaper, don't touch desktop_layout
      await base44.auth.updateMe({ wallpaper: wallpaperId });
      toast.success("Wallpaper updated!");
    } catch (error) {
      console.error("Error updating wallpaper:", error);
      toast.error("Failed to update wallpaper");
    }
  };

  // Planning Center OAuth - Via Vercel
  const handleConnectPCO = () => {
    const vercelUrl = "https://pco-webhook.vercel.app";
    const appUrl = window.location.origin;
    const settingsUrl = `${appUrl}/Settings`;
    const state = user.id;
    
    window.location.href = `${vercelUrl}/api/pco-auth?state=${state}&redirect_url=${encodeURIComponent(settingsUrl)}`;
  };

  const handleDisconnectPCO = async () => {
    try {
      await base44.auth.updateMe({
        pco_access_token: null,
        pco_refresh_token: null,
        pco_token_expires_at: null
      });
      toast.success("Planning Center disconnected");
      loadUser();
    } catch (error) {
      toast.error("Failed to disconnect");
    }
  };

  // ClickUp OAuth - Via Vercel
  const handleConnectClickUp = () => {
    const vercelUrl = "https://pco-webhook.vercel.app";
    const appUrl = window.location.origin;
    const settingsUrl = `${appUrl}/Settings`;
    const state = user.id;
    
    window.location.href = `${vercelUrl}/api/clickup-auth?state=${state}&redirect_url=${encodeURIComponent(settingsUrl)}`;
  };

  const handleDisconnectClickUp = async () => {
    try {
      await base44.auth.updateMe({
        clickup_access_token: null,
        clickup_refresh_token: null,
        clickup_token_expires_at: null
      });
      toast.success("ClickUp disconnected");
      loadUser();
    } catch (error) {
      toast.error("Failed to disconnect");
    }
  };

  // Microsoft OAuth
  const handleConnectMicrosoft = () => {
    const vercelUrl = "https://pco-webhook.vercel.app";
    const appUrl = window.location.origin;
    const settingsUrl = `${appUrl}/Settings`;
    const state = user.id;
    
    window.location.href = `${vercelUrl}/api/microsoft-auth?state=${state}&redirect_url=${encodeURIComponent(settingsUrl)}`;
  };

  const handleDisconnectMicrosoft = async () => {
    try {
      await base44.auth.updateMe({
        microsoft_access_token: null,
        microsoft_refresh_token: null,
        microsoft_token_expires_at: null
      });
      toast.success("Microsoft disconnected");
      loadUser();
    } catch (error) {
      toast.error("Failed to disconnect");
    }
  };

  const handleRearrangeIcons = () => {
    // Assuming '/dashboard' is the correct path for the dashboard page.
    // The query parameter 'edit=true' signals the dashboard to enter rearrangement mode.
    navigate('/dashboard?edit=true'); 
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 h-full overflow-auto">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-slate-100 rounded-xl">
            <SettingsIcon className="w-6 h-6 text-slate-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
            <p className="text-slate-600">Manage your FBCA OS preferences</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="brand">Brand</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={user?.email || ''} readOnly className="bg-slate-50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="display_name">Display Name</Label>
                  <Input
                    id="display_name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={user?.full_name}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g., Facilities, IT, Worship"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role_title">Job Title / Role</Label>
                  <Input
                    id="role_title"
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    placeholder="e.g., Facilities Manager, AV Tech"
                  />
                </div>
                <Button onClick={handleSaveProfile} disabled={saving} className="w-full">
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-4">
            {/* Microsoft 365 Reconnection Notice */}
            {user?.microsoft_access_token && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Mail className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 mb-1">New: Microsoft To Do Support</h3>
                    <p className="text-sm text-slate-600 mb-2">
                      We've added Microsoft To Do integration! If you're getting permission errors, 
                      disconnect and reconnect Microsoft 365 to grant Tasks access.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        handleDisconnectMicrosoft();
                        setTimeout(() => {
                          handleConnectMicrosoft();
                        }, 500);
                      }}
                    >
                      Reconnect Microsoft 365
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-1">
              <ConnectionStatusCard
                title="Planning Center"
                icon={Calendar}
                isConnected={!!user?.pco_access_token}
                onConnect={handleConnectPCO}
                onDisconnect={handleDisconnectPCO}
                description="Sync calendars, events, and service planning"
                color="blue"
              />

              <ConnectionStatusCard
                title="ClickUp"
                icon={CheckSquare}
                isConnected={!!user?.clickup_access_token}
                onConnect={handleConnectClickUp}
                onDisconnect={handleDisconnectClickUp}
                description="Manage tasks, projects, and workflows"
                color="purple"
              />

              <ConnectionStatusCard
                title="Microsoft 365"
                icon={Briefcase}
                isConnected={!!user?.microsoft_access_token}
                onConnect={handleConnectMicrosoft}
                onDisconnect={handleDisconnectMicrosoft}
                description="Access email, calendar, and Office apps"
                color="orange"
              />
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Choose what notifications you receive</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-slate-500">Receive email updates</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Task Reminders</p>
                    <p className="text-sm text-slate-500">Get reminded about pending tasks</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Approval Requests</p>
                    <p className="text-sm text-slate-500">Notifications for approval workflows</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="w-5 h-5" />
                  Desktop Wallpaper
                </CardTitle>
                <CardDescription>Choose your desktop background</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {wallpapers.map((wallpaper) => (
                    <motion.div
                      key={wallpaper.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`relative cursor-pointer rounded-lg overflow-hidden border-4 transition-all ${
                        selectedWallpaper === wallpaper.id
                          ? 'border-blue-600 shadow-lg ring-2 ring-blue-300'
                          : 'border-transparent hover:border-slate-300'
                      }`}
                      onClick={() => handleWallpaperChange(wallpaper.id)}
                    >
                      <img
                        src={wallpaper.url}
                        alt={wallpaper.name}
                        className="w-full h-40 object-cover"
                      />
                      {selectedWallpaper === wallpaper.id && (
                        <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full p-1">
                          <CheckSquare className="w-4 h-4" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                        <p className="text-white text-sm font-medium">{wallpaper.name}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Desktop Layout</CardTitle>
                <CardDescription>Customize your desktop icons</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Rearrange Desktop Icons</p>
                    <p className="text-sm text-slate-500">Drag and drop icons to customize your layout</p>
                  </div>
                  <Button onClick={handleRearrangeIcons}>
                    Rearrange Icons
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Other Appearance Settings</CardTitle>
                <CardDescription>Customize how FBCA OS looks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Dark Mode</p>
                    <p className="text-sm text-slate-500">Switch to dark theme</p>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="brand" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Brand Assets</CardTitle>
                <CardDescription>Manage FBCA brand guidelines, logos, colors, and fonts</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Assuming a route like '/brand-assets' exists for the Brand Assets Manager */}
                <Button onClick={() => navigate('/brand-assets')}> 
                  Open Brand Assets Manager
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="about" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>About FBCA OS</CardTitle>
                <CardDescription>System information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500">Version</p>
                  <p className="font-medium">1.0.0</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Framework</p>
                  <p className="font-medium">Base 44</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Installed Modules</p>
                  <p className="font-medium">Marketing, Food Service, FBCA Nexts</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
