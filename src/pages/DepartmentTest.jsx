import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Users,
  Building2,
  AlertCircle,
  ArrowLeft,
  Loader2,
  Search,
  Crown,
  RefreshCw,
  Cloud,
  Database,
  CheckCircle,
  XCircle,
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export default function DepartmentTest() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [o365Data, setO365Data] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState("o365");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);

      if (user?.role !== 'admin' && user?.role !== 'super_user') {
        navigate(createPageUrl('Dashboard'));
        return;
      }

      // Automatically scan O365 on load
      await scanO365();
      
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const scanO365 = async () => {
    setScanning(true);
    try {
      const response = await base44.functions.invoke('scanO365Departments');
      
      if (response.data?.success) {
        setO365Data(response.data);
        toast.success(`Scanned ${response.data.users.length} users from Microsoft 365`);
      } else {
        toast.error(response.data?.error || 'Failed to scan O365');
      }
    } catch (error) {
      console.error('Error scanning O365:', error);
      toast.error('Failed to scan Microsoft 365');
    } finally {
      setScanning(false);
    }
  };

  const filteredUsers = o365Data?.users?.filter(user => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.displayName?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.o365Department?.toLowerCase().includes(query) ||
      user.o365JobTitle?.toLowerCase().includes(query)
    );
  }) || [];

  const groupByDepartment = () => {
    const groups = {};
    filteredUsers.forEach(user => {
      const dept = user.o365Department || '(No Department)';
      if (!groups[dept]) {
        groups[dept] = [];
      }
      groups[dept].push(user);
    });
    return groups;
  };

  const departmentGroups = groupByDepartment();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-blue-50 to-indigo-50 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto pb-20">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl('Settings') + '?tab=admin')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-7 h-7 text-blue-600" />
              Department Scanner
              <Crown className={`w-5 h-5 ${currentUser?.role === 'super_user' ? 'text-purple-500' : 'text-orange-500'}`} />
            </h1>
            <p className="text-slate-600">Scan Microsoft 365 for department assignments</p>
          </div>
          <Button
            onClick={scanO365}
            disabled={scanning}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning...' : 'Refresh'}
          </Button>
        </div>

        {!o365Data ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Cloud className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Ready to Scan
              </h3>
              <p className="text-slate-600 mb-6">
                Click "Refresh" to scan Microsoft 365 for department data
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Total Users (O365)</p>
                      <p className="text-2xl font-bold text-slate-900">{o365Data.stats.total}</p>
                    </div>
                    <Cloud className="w-8 h-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">With Department</p>
                      <p className="text-2xl font-bold text-green-700">{o365Data.stats.withDepartment}</p>
                      <p className="text-xs text-slate-500">
                        {Math.round(o365Data.stats.withDepartment / o365Data.stats.total * 100)}%
                      </p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">No Department</p>
                      <p className="text-2xl font-bold text-red-700">{o365Data.stats.withoutDepartment}</p>
                      <p className="text-xs text-slate-500">
                        {Math.round(o365Data.stats.withoutDepartment / o365Data.stats.total * 100)}%
                      </p>
                    </div>
                    <XCircle className="w-8 h-8 text-red-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Needs Sync</p>
                      <p className="text-2xl font-bold text-orange-700">{o365Data.syncStats.needsSync}</p>
                      <p className="text-xs text-slate-500">to Base44</p>
                    </div>
                    <RefreshCw className="w-8 h-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sync Status Banner */}
            {o365Data.syncStats.needsSync > 0 && (
              <Card className="mb-6 border-orange-300 bg-orange-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-orange-900 mb-1">
                        {o365Data.syncStats.needsSync} users need department sync
                      </h3>
                      <p className="text-sm text-orange-800">
                        These users have department data in Microsoft 365 but it hasn't synced to Base44 yet. 
                        They'll sync automatically on their next login.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Department List */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  Unique Departments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {o365Data.uniqueDepartments.map((dept) => (
                    <Badge key={dept} variant="outline" className="text-sm">
                      {dept}
                    </Badge>
                  ))}
                  {o365Data.uniqueDepartments.length === 0 && (
                    <p className="text-sm text-slate-500">No departments found</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Search */}
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    placeholder="Search by name, email, department, or title..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Users List */}
            <div className="space-y-4">
              {Object.entries(departmentGroups)
                .sort((a, b) => {
                  if (a[0] === '(No Department)') return 1;
                  if (b[0] === '(No Department)') return -1;
                  return b[1].length - a[1].length;
                })
                .map(([department, deptUsers]) => (
                  <motion.div
                    key={department}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card>
                      <CardHeader className={`border-b ${department === '(No Department)' ? 'bg-red-50' : 'bg-slate-50'}`}>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2">
                            {department === '(No Department)' ? (
                              <AlertCircle className="w-5 h-5 text-red-600" />
                            ) : (
                              <Building2 className="w-5 h-5 text-blue-600" />
                            )}
                            {department}
                          </CardTitle>
                          <Badge variant="outline" className={department === '(No Department)' ? 'border-red-300 text-red-700' : ''}>
                            {deptUsers.length} {deptUsers.length === 1 ? 'user' : 'users'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="divide-y">
                          {deptUsers.map((user, idx) => (
                            <div key={idx} className="p-4 hover:bg-slate-50 transition-colors">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="font-semibold text-slate-900">{user.displayName}</p>
                                    {user.base44Role === 'admin' && (
                                      <Badge className="bg-orange-100 text-orange-700 text-xs">Admin</Badge>
                                    )}
                                    {user.base44Role === 'super_user' && (
                                      <Badge className="bg-purple-100 text-purple-700 text-xs">Super Admin</Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-slate-600">{user.email}</p>
                                  {user.o365JobTitle && (
                                    <p className="text-sm text-slate-500 mt-1">{user.o365JobTitle}</p>
                                  )}
                                  
                                  {/* Sync Status */}
                                  <div className="flex items-center gap-2 mt-2">
                                    {user.inBase44 ? (
                                      user.departmentMatch ? (
                                        <Badge className="bg-green-100 text-green-700 text-xs flex items-center gap-1">
                                          <CheckCircle className="w-3 h-3" />
                                          Synced
                                        </Badge>
                                      ) : (
                                        <Badge className="bg-orange-100 text-orange-700 text-xs flex items-center gap-1">
                                          <RefreshCw className="w-3 h-3" />
                                          Needs Sync
                                        </Badge>
                                      )
                                    ) : (
                                      <Badge className="bg-slate-100 text-slate-700 text-xs flex items-center gap-1">
                                        <Database className="w-3 h-3" />
                                        Not in Base44
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right text-xs text-slate-500">
                                  {user.o365Department && (
                                    <div className="flex items-center gap-1 mb-1">
                                      <Cloud className="w-3 h-3" />
                                      <span>O365: {user.o365Department}</span>
                                    </div>
                                  )}
                                  {user.inBase44 && user.base44Department && (
                                    <div className="flex items-center gap-1">
                                      <Database className="w-3 h-3" />
                                      <span>Base44: {user.base44Department}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
            </div>

            {/* No Results */}
            {Object.keys(departmentGroups).length === 0 && (
              <Card>
                <CardContent className="p-12 text-center">
                  <Search className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No Results</h3>
                  <p className="text-slate-600">Try adjusting your search</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}