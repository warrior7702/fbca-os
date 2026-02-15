import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Settings as SettingsIcon, User, Bell, Lock, Palette, Info, Link as LinkIcon, Image, Mail, Bug, Shield, Database, Plus, Edit2, Save, X, Users, Crown, CheckCircle, XCircle, Loader2, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import ConnectionStatusCard from "../components/settings/ConnectionStatusCard";
import NotificationPreferencesSection from "../components/settings/NotificationPreferencesSection";
import InitializeAchievementsButton from "../components/settings/InitializeAchievementsButton";
import { Calendar, Briefcase } from "lucide-react";
import { CheckSquare } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";

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
  const [isSSOUser, setIsSSOUser] = useState(false);

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
      
      // Check if user logged in via SSO (email domain OR has Microsoft token)
      // If they have @fbcarlington.org email, assume SSO user
      const loggedInViaSSO = currentUser.email?.includes('@fbcarlington.org');
      setIsSSOUser(loggedInViaSSO);
      
      console.log('🔐 User loaded:', {
        email: currentUser.email,
        isSSOUser: loggedInViaSSO,
        hasMicrosoftToken: !!currentUser.microsoft_access_token
      });
      
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
    if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) {
      return;
    }

    try {
      console.log('🔄 Starting role change:', { userId, newRole, currentUserRole: user?.role });
      
      // Show loading state
      setAllUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, _updating: true } : u
      ));
      
      // Call backend function to update role
      const response = await base44.functions.invoke('updateUserRole', {
        user_id: userId,
        role: newRole
      });
      
      console.log('📦 Response:', response.data);
      
      if (response.data.success) {
        console.log('✅ Role changed successfully!');
        toast.success(`User role updated to ${newRole}`);
        
        // Wait a moment for database to update
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Update the local state immediately
        setAllUsers(prev => prev.map(u => 
          u.id === userId ? { ...u, role: newRole, _updating: false } : u
        ));
        
        // If we just changed our own role, reload the page
        if (userId === user.id) {
          toast.success('Your role was updated! Refreshing...');
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
        
        // Reload all users to ensure consistency
        setTimeout(() => {
          loadAllUsers();
        }, 1000);
      } else {
        throw new Error(response.data.error || 'Failed to update role');
      }
      
    } catch (error) {
      console.error("❌ Error changing user role:", error);
      console.error("❌ Error details:", {
        message: error.message,
        response: error.response,
        data: error.response?.data
      });
      
      // Show detailed error
      const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
      toast.error(`Failed to change role: ${errorMsg}`, {
        duration: 5000
      });
      
      // Remove loading state and reload to get correct state
      setAllUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, _updating: false } : u
      ));
      
      // Reload users to ensure we have the correct state
      setTimeout(() => {
        loadAllUsers();
      }, 500);
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
    try {
      console.log('🔗 Starting direct PCO connection...');
      
      // Direct redirect to the initPCOAuthDirect endpoint
      window.location.href = `${window.location.origin}/api/functions/initPCOAuthDirect`;
    } catch (error) {
      console.error('❌ PCO connection error:', error);
      toast.error('Failed to connect: ' + error.message);
    }
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



  const handleConnectMicrosoft = () => {
    // SSO users should never need to manually connect
    if (isSSOUser) {
      toast.info("You're logged in via Microsoft SSO! Your Microsoft 365 is automatically connected. Try refreshing the page if you don't see it.");
      return;
    }
    
    const vercelUrl = "https://pco-webhook.vercel.app";
    const appUrl = window.location.origin;
    const settingsUrl = `${appUrl}/Settings`;
    const state = user.id;
    
    window.location.href = `${vercelUrl}/api/microsoft-auth?state=${state}&redirect_url=${encodeURIComponent(settingsUrl)}`;
  };

  const handleDisconnectMicrosoft = async () => {
    if (isSSOUser) {
      toast.error("Cannot disconnect Microsoft 365 - you're logged in via Microsoft SSO. Disconnecting would log you out!");
      return;
    }
    
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
            {/* SSO Info Banner - Show for all @fbcarlington.org users */}
            {isSSOUser && (
              <Card className="border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-green-100 rounded-xl">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-green-900 mb-2 text-lg">🎉 All Set! Microsoft SSO Active</h3>
                      <p className="text-sm text-green-800 mb-3 leading-relaxed">
                        You're signed in via Microsoft Single Sign-On with <strong>full Microsoft 365 access</strong>! 
                        Everything is automatically connected and ready to use.
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-2 text-green-700">
                          <CheckCircle className="w-4 h-4" />
                          <span>📧 Email & Inbox</span>
                        </div>
                        <div className="flex items-center gap-2 text-green-700">
                          <CheckCircle className="w-4 h-4" />
                          <span>📅 Calendar</span>
                        </div>
                        <div className="flex items-center gap-2 text-green-700">
                          <CheckCircle className="w-4 h-4" />
                          <span>📁 OneDrive Files</span>
                        </div>
                        <div className="flex items-center gap-2 text-green-700">
                          <CheckCircle className="w-4 h-4" />
                          <span>✅ Microsoft To Do</span>
                        </div>
                      </div>
                      <p className="text-xs text-green-600 mt-3 italic">
                        No additional setup needed - you're ready to go!
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Only show this for non-SSO users who connected manually */}
            {user?.microsoft_access_token && !isSSOUser && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Mail className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 mb-1">Microsoft 365 Connected</h3>
                    <p className="text-sm text-slate-600 mb-2">
                      You've manually connected Microsoft 365. All features are working!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Email Polling Service */}
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

              {/* Microsoft 365 Card - ONLY show if NOT an SSO user */}
              {!isSSOUser && (
                <Card className={`border-2 ${user?.microsoft_access_token ? 'border-green-300' : 'border-slate-200'}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-orange-50 border-orange-200 text-orange-700">
                          <Briefcase className="w-6 h-6" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Microsoft 365</CardTitle>
                          <p className="text-sm text-slate-500 mt-1">
                            Access email, calendar, and Office apps
                          </p>
                        </div>
                      </div>
                      {user?.microsoft_access_token ? (
                        <Badge className="bg-green-100 text-green-700 border-green-300">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Connected
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-500">
                          <XCircle className="w-3 h-3 mr-1" />
                          Not Connected
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {user?.microsoft_access_token ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          <span>Active connection</span>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={handleDisconnectMicrosoft}
                        >
                          Disconnect
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Button 
                          onClick={handleConnectMicrosoft}
                          className="w-full"
                        >
                          Connect Microsoft 365
                        </Button>
                        <p className="text-xs text-slate-500 text-center">
                          💡 Tip: Login with Microsoft SSO for automatic connection!
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
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
            <NotificationPreferencesSection user={user} />
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
                    <div className="flex gap-2 flex-wrap">
                      <Button onClick={() => navigate(createPageUrl('RoleManagement'))} variant="outline">
                        <Shield className="w-4 h-4 mr-2" />
                        Role Management
                      </Button>
                      <Button onClick={() => navigate(createPageUrl('AssignmentRules'))} variant="outline">
                        <Settings className="w-4 h-4 mr-2" />
                        Assignment Rules
                      </Button>
                      <Button onClick={() => navigate(createPageUrl('TicketRoleVerification'))} variant="outline">
                        <Shield className="w-4 h-4 mr-2" />
                        Ticket Roles
                      </Button>
                      <Button onClick={() => navigate(createPageUrl('DepartmentTest'))} variant="outline">
                        <Database className="w-4 h-4 mr-2" />
                        Departments
                      </Button>
                      <Button onClick={() => navigate(createPageUrl('EmailTemplateEditor'))} variant="outline">
                        <Mail className="w-4 h-4 mr-2" />
                        Email Templates
                      </Button>
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

              {/* Achievements System */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-600" />
                    Achievements System
                  </CardTitle>
                  <CardDescription>
                    Initialize the gamification system with badges and rewards
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-amber-800">
                        <p className="font-semibold mb-1">One-Time Setup</p>
                        <p>Click below to create 30+ achievements across tasks, approvals, tickets, events, and hidden challenges. Once initialized, users can view their progress at /achievements.</p>
                      </div>
                    </div>
                  </div>
                  <InitializeAchievementsButton />
                </CardContent>
              </Card>

              {/* User Management Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    User Management
                  </CardTitle>
                  <CardDescription>
                    Manage user roles and permissions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-blue-800">
                        <p className="font-semibold mb-1">Role Management</p>
                        <p>Use the dropdown below to change user roles. If you get an error, you can also edit roles through the <strong>Base44 Dashboard → Data → Users</strong>.</p>
                      </div>
                    </div>
                  </div>

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
                        <Card key={u.id}>
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
                              
                              {u._updating ? (
                                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                              ) : (
                                <Select
                                  value={u.role}
                                  onValueChange={(newRole) => handleChangeUserRole(u.id, newRole)}
                                  disabled={u._updating}
                                >
                                  <SelectTrigger className="w-40">
                                    <SelectValue>
                                      <div className="flex items-center gap-2">
                                        {(u.role === 'super_user' || u.role === 'admin') && (
                                          <Crown className="w-3 h-3" />
                                        )}
                                        {u.role === 'super_user' ? 'Super User' : u.role === 'admin' ? 'Admin' : 'User'}
                                      </div>
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="user">
                                      <div className="flex items-center gap-2">
                                        <User className="w-4 h-4" />
                                        User
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="admin">
                                      <div className="flex items-center gap-2">
                                        <Crown className="w-4 h-4 text-orange-600" />
                                        Admin
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="super_user">
                                      <div className="flex items-center gap-2">
                                        <Crown className="w-4 h-4 text-purple-600" />
                                        Super User
                                      </div>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Hospitality App Upload Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-green-600" />
                    Hospitality App Integration
                  </CardTitle>
                  <CardDescription>
                    Upload entity JSON files from the hospitality app to integrate food service functionality
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-green-800">
                        <p className="font-semibold mb-1">Entity Files Upload</p>
                        <p className="mb-2">Upload the following JSON files from the hospitality app's <code>entities/</code> folder:</p>
                        <ul className="list-disc list-inside space-y-1 text-xs">
                          <li>Category.json</li>
                          <li>MenuItem.json</li>
                          <li>SavedOrder.json</li>
                          <li>BillingAccount.json</li>
                          <li>Any other entity files you need</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="entity-files">Select Entity JSON Files</Label>
                    <Input
                      id="entity-files"
                      type="file"
                      accept=".json"
                      multiple
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length === 0) return;

                        try {
                          const fileContents = await Promise.all(
                            files.map(file => {
                              return new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  try {
                                    const content = event.target.result;
                                    resolve({ name: file.name, content });
                                  } catch (error) {
                                    reject(error);
                                  }
                                };
                                reader.onerror = reject;
                                reader.readAsText(file);
                              });
                            })
                          );

                          // Display file contents
                          const display = fileContents.map(f => 
                            `=== ${f.name} ===\n${f.content}`
                          ).join('\n\n');

                          toast.success(`Loaded ${files.length} file(s). Copy the content below and paste it in chat.`, {
                            duration: 10000
                          });

                          // Create a textarea to display content for copying
                          const textarea = document.createElement('textarea');
                          textarea.value = display;
                          textarea.style.position = 'fixed';
                          textarea.style.top = '50%';
                          textarea.style.left = '50%';
                          textarea.style.transform = 'translate(-50%, -50%)';
                          textarea.style.width = '80%';
                          textarea.style.height = '80%';
                          textarea.style.zIndex = '9999';
                          textarea.style.padding = '20px';
                          textarea.style.border = '3px solid #3b82f6';
                          textarea.style.borderRadius = '8px';
                          textarea.style.fontSize = '12px';
                          textarea.style.fontFamily = 'monospace';
                          document.body.appendChild(textarea);
                          textarea.select();

                          // Add close button
                          const closeBtn = document.createElement('button');
                          closeBtn.textContent = '✕ Close';
                          closeBtn.style.position = 'fixed';
                          closeBtn.style.top = 'calc(50% - 42%)';
                          closeBtn.style.right = 'calc(50% - 42%)';
                          closeBtn.style.zIndex = '10000';
                          closeBtn.style.padding = '8px 16px';
                          closeBtn.style.background = '#ef4444';
                          closeBtn.style.color = 'white';
                          closeBtn.style.border = 'none';
                          closeBtn.style.borderRadius = '4px';
                          closeBtn.style.cursor = 'pointer';
                          closeBtn.onclick = () => {
                            textarea.remove();
                            closeBtn.remove();
                          };
                          document.body.appendChild(closeBtn);

                        } catch (error) {
                          console.error('Error reading files:', error);
                          toast.error('Failed to read files: ' + error.message);
                        }
                      }}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-slate-500">
                      📁 Select multiple JSON files at once. After upload, copy the displayed content and paste it in the chat.
                    </p>
                  </div>
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