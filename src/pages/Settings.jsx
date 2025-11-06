
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Settings as SettingsIcon, User, Bell, Lock, Palette, Info, Link as LinkIcon, Image, Mail, Bug, Shield, Database, Plus, Edit2, Save, X, Users, Crown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import ConnectionStatusCard from "../components/settings/ConnectionStatusCard";
import { Calendar, CheckSquare, Briefcase } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import EmailPollingService from "../components/settings/EmailPollingService";

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
  const [selectedWallpaper, setSelectedWallpaper] = useState("cross_white_glow");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  // Admin section states
  const [cardholders, setCardholders] = useState([]);
  const [loadingCardholders, setLoadingCardholders] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingCardholder, setEditingCardholder] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newCardholder, setNewCardholder] = useState({ name: "", pin: "", member_id: "", email: "" });

  // User management states
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    loadUser();
    
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    
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
        const errorType = urlParams.get('error');
        if (errorType === 'pco_auth_failed') {
          toast.error('PCO connection failed. Please try again.');
        } else if (errorType === 'token_exchange_failed') {
          toast.error('Failed to exchange PCO tokens. Please try again.');
        } else if (errorType === 'callback_failed') {
          toast.error('PCO callback failed. Please try again.');
        } else {
          toast.error('Connection failed. Please try again.');
        }
      }
      
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'admin' && (user?.role === 'admin' || user?.role === 'super_user')) {
      loadCardholders();
      loadAllUsers();
    }
  }, [activeTab, user]);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setDisplayName(currentUser.display_name || "");
      setDepartment(currentUser.department || "");
      setRoleTitle(currentUser.role_title || "");
      setSelectedWallpaper(currentUser.wallpaper || "cross_white_glow");
    } catch (error) {
      console.error("Error loading user:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const loadCardholders = async () => {
    setLoadingCardholders(true);
    try {
      const data = await base44.entities.Cardholder.list('name');
      setCardholders(data);
    } catch (error) {
      console.error("Error loading cardholders:", error);
      toast.error("Failed to load cardholders");
    } finally {
      setLoadingCardholders(false);
    }
  };

  const loadAllUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await base44.entities.User.list('full_name');
      setAllUsers(data);
    } catch (error) {
      console.error("Error loading users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleChangeUserRole = async (userId, newRole) => {
    try {
      console.log('🔄 Changing role for user:', userId, 'to:', newRole);
      
      const response = await base44.functions.invoke('setUserRole', {
        user_id: userId,
        role: newRole
      });
      
      console.log('✅ Role change response:', response.data);
      
      toast.success(`User role updated to ${newRole}`);
      
      // Reload users list
      await loadAllUsers();
      
      // If we just changed our own role, reload the page
      if (userId === user.id) {
        toast.success('Your role was updated! Refreshing...');
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (error) {
      console.error("❌ Error changing user role:", error);
      toast.error("Failed to change user role: " + (error.message || 'Unknown error'));
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
      await base44.auth.updateMe({ wallpaper: wallpaperId });
      toast.success("Wallpaper updated!");
    } catch (error) {
      console.error("Error updating wallpaper:", error);
      toast.error("Failed to update wallpaper");
    }
  };

  const handleEditCardholder = async (cardholder) => {
    if (cardholder.pin.length !== 6 || !/^\d{6}$/.test(cardholder.pin)) {
      toast.error("PIN must be 6 digits");
      return;
    }
    try {
      await base44.entities.Cardholder.update(cardholder.id, {
        name: cardholder.name,
        pin: cardholder.pin,
        member_id: cardholder.member_id || null,
        email: cardholder.email || null
      });
      toast.success("Cardholder updated!");
      setEditingCardholder(null);
      loadCardholders();
    } catch (error) {
      console.error("Error updating cardholder:", error);
      toast.error("Failed to update cardholder");
    }
  };

  const handleAddCardholder = async () => {
    if (!newCardholder.name || !newCardholder.pin) {
      toast.error("Name and PIN are required");
      return;
    }

    if (newCardholder.pin.length !== 6 || !/^\d{6}$/.test(newCardholder.pin)) {
      toast.error("PIN must be 6 digits");
      return;
    }

    try {
      const payload = {
        ...newCardholder,
        member_id: newCardholder.member_id || null,
        email: newCardholder.email || null,
      };
      await base44.entities.Cardholder.create(payload);
      toast.success("Cardholder added!");
      setShowAddDialog(false);
      setNewCardholder({ name: "", pin: "", member_id: "", email: "" });
      loadCardholders();
    } catch (error) {
      console.error("Error adding cardholder:", error);
      toast.error("Failed to add cardholder");
    }
  };

  const handleDeleteCardholder = async (id) => {
    if (!confirm("Are you sure you want to delete this cardholder?")) return;
    
    try {
      await base44.entities.Cardholder.delete(id);
      toast.success("Cardholder deleted");
      loadCardholders();
    } catch (error) {
      console.error("Error deleting cardholder:", error);
      toast.error("Failed to delete cardholder");
    }
  };

  const handleConnectPCO = () => {
    const vercelUrl = "https://pco-webhook.vercel.app";
    const appUrl = window.location.origin;
    const settingsUrl = `${appUrl}/Settings`;
    const state = user.id;
    
    console.log('🔗 Starting PCO connection...');
    console.log('  - User ID:', state);
    console.log('  - Redirect back to:', settingsUrl);
    
    if (!state) {
      toast.error('User ID not available. Please refresh and try again.');
      return;
    }
    
    const authUrl = `${vercelUrl}/api/pco-auth?state=${encodeURIComponent(state)}&redirect_url=${encodeURIComponent(settingsUrl)}`;
    
    console.log('🔗 Redirecting to:', authUrl);
    window.location.href = authUrl;
  };

  const handleDisconnectPCO = async () => {
    try {
      await base44.auth.updateMe({
        pco_access_token: null,
        pco_refresh_token: null,
        pco_token_expires_at: null,
        pco_user_id: null
      });
      toast.success("Planning Center disconnected");
      loadUser();
    } catch (error) {
      toast.error("Failed to disconnect");
    }
  };

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
    navigate(createPageUrl('Dashboard') + '?edit=true'); 
  };

  const filteredCardholders = cardholders.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.pin.includes(searchQuery) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUsers = allUsers.filter(u =>
    u.full_name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

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
    <div className="h-full bg-gradient-to-br from-slate-50 to-gray-50 p-6 md:p-8 overflow-auto">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-gradient-to-br from-slate-500 to-slate-600 rounded-xl shadow-lg">
            <SettingsIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
            <p className="text-slate-600">Manage your FBCA OS preferences</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className={`grid w-full ${user?.role === 'admin' || user?.role === 'super_user' ? 'grid-cols-7' : 'grid-cols-6'}`}>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="brand">Brand</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
            {(user?.role === 'admin' || user?.role === 'super_user') && (
              <TabsTrigger value="admin">
                <Shield className="w-4 h-4 mr-1" />
                {user?.role === 'super_user' ? 'Super Admin' : 'Admin'}
              </TabsTrigger>
            )}
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

            {/* Email Polling Service - NEW */}
            {(user?.role === 'admin' || user?.role === 'super_user') && (
              <EmailPollingService user={user} />
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

            {user?.pco_access_token && (
              <Card className="border-purple-200 bg-purple-50 mt-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-purple-900">
                    <Bug className="w-5 h-5" />
                    Planning Center Diagnostics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 mb-3">
                    Having issues with approvals not showing? Use the diagnostics tool to see your approval groups, pending requests, and connection status.
                  </p>
                  <Button
                    onClick={() => navigate(createPageUrl('PCODebug'))}
                    variant="outline"
                    className="border-purple-300 hover:bg-purple-100"
                  >
                    <Bug className="w-4 h-4 mr-2" />
                    Run PCO Diagnostics
                  </Button>
                </CardContent>
              </Card>
            )}
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
                <Button onClick={() => navigate(createPageUrl('BrandAssets'))}> 
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

          {(user?.role === 'admin' || user?.role === 'super_user') && (
            <TabsContent value="admin" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className={`w-5 h-5 ${user?.role === 'super_user' ? 'text-purple-600' : 'text-orange-600'}`} />
                        {user?.role === 'super_user' ? 'Super User Tools' : 'Admin Tools'}
                      </CardTitle>
                      <CardDescription>
                        {user?.role === 'super_user' 
                          ? 'Full system access - manage everything'
                          : 'Manage system data and configurations'
                        }
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => navigate(createPageUrl('PCOAPITester'))} variant="outline">
                        <Bug className="w-4 h-4 mr-2" />
                        API Tester
                      </Button>
                      <Button onClick={() => navigate(createPageUrl('TestCardholders'))} variant="outline">
                        <Database className="w-4 h-4 mr-2" />
                        Database Test
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* User Management Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    User Management
                  </CardTitle>
                  <CardDescription>
                    Manage user roles and permissions. Changes save automatically.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    type="text"
                    placeholder="Search by name or email..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="max-w-md"
                  />

                  {loadingUsers ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-slate-600 mb-2">
                        Showing {filteredUsers.length} of {allUsers.length} users
                      </p>
                      {filteredUsers.map((u) => (
                        <Card key={u.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                                  <span className="text-white text-sm font-bold">
                                    {u.full_name?.[0]?.toUpperCase() || 'U'}
                                  </span>
                                </div>
                                <div>
                                  <p className="font-semibold">{u.full_name}</p>
                                  <p className="text-sm text-slate-600">{u.email}</p>
                                  {u.department && (
                                    <p className="text-xs text-slate-500">{u.department}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Select
                                  value={u.role || 'user'}
                                  onValueChange={(value) => handleChangeUserRole(u.id, value)}
                                >
                                  <SelectTrigger className="w-40">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="user">
                                      <span className="flex items-center gap-2">
                                        User
                                      </span>
                                    </SelectItem>
                                    <SelectItem value="admin">
                                      <span className="flex items-center gap-2">
                                        Admin
                                      </span>
                                    </SelectItem>
                                    <SelectItem value="super_user">
                                      <span className="flex items-center gap-2">
                                        Super User
                                      </span>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                {u.role === 'super_user' && (
                                  <Crown className="w-5 h-5 text-purple-500" />
                                )}
                                {u.role === 'admin' && (
                                  <Crown className="w-5 h-5 text-orange-500" />
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Door Code Management Section */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Door Code Management</CardTitle>
                      <CardDescription>
                        Manage cardholders and door codes for building access approvals
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => navigate(createPageUrl('ImportCardholders'))} variant="outline">
                        <Database className="w-4 h-4 mr-2" />
                        Import Data
                      </Button>
                      <Button onClick={() => setShowAddDialog(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Cardholder
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    type="text"
                    placeholder="Search by name, PIN, or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-md"
                  />

                  {loadingCardholders ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-slate-600 mb-2">
                        Showing {filteredCardholders.length} of {cardholders.length} cardholders
                      </p>
                      {filteredCardholders.slice(0, 50).map((cardholder) => (
                        <Card key={cardholder.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            {editingCardholder?.id === cardholder.id ? (
                              <div className="space-y-3">
                                <div className="grid md:grid-cols-2 gap-3">
                                  <div>
                                    <Label className="text-xs">Name</Label>
                                    <Input
                                      value={editingCardholder.name}
                                      onChange={(e) => setEditingCardholder({...editingCardholder, name: e.target.value})}
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">PIN (6 digits)</Label>
                                    <Input
                                      value={editingCardholder.pin}
                                      onChange={(e) => setEditingCardholder({...editingCardholder, pin: e.target.value})}
                                      maxLength={6}
                                      onKeyPress={(event) => {
                                        if (!/[0-9]/.test(event.key)) {
                                          event.preventDefault();
                                        }
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Member ID</Label>
                                    <Input
                                      value={editingCardholder.member_id || ''}
                                      onChange={(e) => setEditingCardholder({...editingCardholder, member_id: e.target.value})}
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Email</Label>
                                    <Input
                                      value={editingCardholder.email || ''}
                                      onChange={(e) => setEditingCardholder({...editingCardholder, email: e.target.value})}
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-2 mt-4">
                                  <Button size="sm" onClick={() => handleEditCardholder(editingCardholder)}>
                                    <Save className="w-4 h-4 mr-1" />
                                    Save
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setEditingCardholder(null)}>
                                    <X className="w-4 h-4 mr-1" />
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <div className="flex-1 grid md:grid-cols-4 gap-4">
                                  <div>
                                    <p className="text-xs text-slate-500">Name</p>
                                    <p className="font-semibold">{cardholder.name}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-500">PIN</p>
                                    <p className="font-mono font-semibold text-blue-600">{cardholder.pin}#</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-500">Member ID</p>
                                    <p className="text-sm">{cardholder.member_id || '—'}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-500">Email</p>
                                    <p className="text-sm truncate">{cardholder.email || '—'}</p>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline" onClick={() => setEditingCardholder(cardholder)}>
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => handleDeleteCardholder(cardholder.id)}>
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                      {filteredCardholders.length > 50 && (
                        <p className="text-sm text-slate-500 text-center py-4">
                          Showing first 50 results. Use search to narrow down.
                        </p>
                      )}
                      {filteredCardholders.length === 0 && !loadingCardholders && (
                        <p className="text-sm text-slate-500 text-center py-4">No cardholders found.</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Add Cardholder Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Cardholder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={newCardholder.name}
                onChange={(e) => setNewCardholder({...newCardholder, name: e.target.value})}
                placeholder="Full name"
              />
            </div>
            <div>
              <Label>PIN Code * (6 digits)</Label>
              <Input
                value={newCardholder.pin}
                onChange={(e) => setNewCardholder({...newCardholder, pin: e.target.value})}
                placeholder="123456"
                maxLength={6}
                onKeyPress={(event) => {
                  if (!/[0-9]/.test(event.key)) {
                    event.preventDefault();
                  }
                }}
              />
            </div>
            <div>
              <Label>Member ID</Label>
              <Input
                value={newCardholder.member_id}
                onChange={(e) => setNewCardholder({...newCardholder, member_id: e.target.value})}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                value={newCardholder.email}
                onChange={(e) => setNewCardholder({...newCardholder, email: e.target.value})}
                placeholder="Optional"
                type="email"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCardholder}>
              <Plus className="w-4 h-4 mr-2" />
              Add Cardholder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
