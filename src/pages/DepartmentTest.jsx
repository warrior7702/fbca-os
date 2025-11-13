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
  Crown
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

export default function DepartmentTest() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);

      // Only admins can view this
      if (user?.role !== 'admin' && user?.role !== 'super_user') {
        navigate(createPageUrl('Dashboard'));
        return;
      }

      const allUsers = await base44.entities.User.list();
      setUsers(allUsers);
      
      console.log('👥 ========== DEPARTMENT DATA TEST ==========');
      console.log('Total Users:', allUsers.length);
      
      const withDept = allUsers.filter(u => u.department);
      const withoutDept = allUsers.filter(u => !u.department);
      
      console.log('✅ Users WITH department:', withDept.length);
      console.log('❌ Users WITHOUT department:', withoutDept.length);
      
      // Group by department
      const deptGroups = {};
      allUsers.forEach(user => {
        const dept = user.department || '(No Department)';
        if (!deptGroups[dept]) {
          deptGroups[dept] = [];
        }
        deptGroups[dept].push(user);
      });
      
      console.log('\n📊 Department Breakdown:');
      Object.entries(deptGroups)
        .sort((a, b) => b[1].length - a[1].length)
        .forEach(([dept, users]) => {
          console.log(`  ${dept}: ${users.length} users`);
        });
      
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupByDepartment = () => {
    const groups = {};
    users.forEach(user => {
      const dept = user.department || '(No Department)';
      if (!groups[dept]) {
        groups[dept] = [];
      }
      groups[dept].push(user);
    });
    return groups;
  };

  const filteredUsers = users.filter(user => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.full_name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.department?.toLowerCase().includes(query) ||
      user.title?.toLowerCase().includes(query)
    );
  });

  const departmentGroups = groupByDepartment();
  const filteredGroups = {};
  
  Object.entries(departmentGroups).forEach(([dept, deptUsers]) => {
    const filtered = deptUsers.filter(user => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        user.full_name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.department?.toLowerCase().includes(query) ||
        user.title?.toLowerCase().includes(query)
      );
    });
    if (filtered.length > 0) {
      filteredGroups[dept] = filtered;
    }
  });

  const stats = {
    total: users.length,
    withDepartment: users.filter(u => u.department).length,
    withoutDepartment: users.filter(u => !u.department).length,
    uniqueDepartments: Object.keys(departmentGroups).filter(d => d !== '(No Department)').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
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
            onClick={() => navigate(createPageUrl('Settings'))}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-7 h-7 text-blue-600" />
              Department Test
              <Crown className={`w-5 h-5 ${currentUser?.role === 'super_user' ? 'text-purple-500' : 'text-orange-500'}`} />
            </h1>
            <p className="text-slate-600">View user departments from Microsoft 365</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total Users</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">With Department</p>
                  <p className="text-2xl font-bold text-green-700">{stats.withDepartment}</p>
                </div>
                <Building2 className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">No Department</p>
                  <p className="text-2xl font-bold text-red-700">{stats.withoutDepartment}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Departments</p>
                  <p className="text-2xl font-bold text-purple-700">{stats.uniqueDepartments}</p>
                </div>
                <Building2 className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

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

        {/* Departments List */}
        <div className="space-y-4">
          {Object.entries(filteredGroups)
            .sort((a, b) => {
              // Sort: departments with data first, then by user count
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
                      {deptUsers.map((user) => (
                        <div key={user.id} className="p-4 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-slate-900">{user.full_name}</p>
                                {user.role === 'admin' && (
                                  <Badge className="bg-orange-100 text-orange-700 text-xs">Admin</Badge>
                                )}
                                {user.role === 'super_user' && (
                                  <Badge className="bg-purple-100 text-purple-700 text-xs">Super Admin</Badge>
                                )}
                              </div>
                              <p className="text-sm text-slate-600">{user.email}</p>
                              {user.title && (
                                <p className="text-sm text-slate-500 mt-1">{user.title}</p>
                              )}
                            </div>
                            <div className="text-right">
                              {user.department ? (
                                <Badge className="bg-green-100 text-green-700">
                                  Has Dept
                                </Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-700">
                                  Missing Dept
                                </Badge>
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
        {Object.keys(filteredGroups).length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Search className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No Results</h3>
              <p className="text-slate-600">Try adjusting your search</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}