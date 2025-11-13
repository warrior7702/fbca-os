import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
    Users,
    Briefcase,
    AlertCircle,
    ArrowLeft,
    Loader2,
    Search,
    CheckCircle,
    XCircle,
    Building2,
    Shield,
    UserCheck,
    UserX,
    RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function TicketRoleVerification() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [fetching, setFetching] = useState(false);
    const [data, setData] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentUser, setCurrentUser] = useState(null);
    const [activeTab, setActiveTab] = useState("workers");

    useEffect(() => {
        loadUser();
    }, []);

    const loadUser = async () => {
        try {
            const user = await base44.auth.me();
            setCurrentUser(user);
        } catch (error) {
            console.error('Error loading user:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUserData = async () => {
        setFetching(true);
        try {
            console.log('🔍 Fetching ticket role data...');
            const response = await base44.functions.invoke('getUsersWithTicketRoles');
            console.log('📥 Response:', response.data);

            if (response.data?.success) {
                setData(response.data);
                toast.success(`✅ Loaded ${response.data.stats.total} users!`);
            } else {
                toast.error(response.data?.error || 'Failed to fetch data');
            }
        } catch (error) {
            console.error('❌ Error:', error);
            toast.error('Failed to fetch user data');
        } finally {
            setFetching(false);
        }
    };

    const filterUsers = (users) => {
        if (!searchQuery) return users;
        const query = searchQuery.toLowerCase();
        return users.filter(u =>
            u.displayName?.toLowerCase().includes(query) ||
            u.email?.toLowerCase().includes(query) ||
            u.osDept?.toLowerCase().includes(query) ||
            u.department?.toLowerCase().includes(query)
        );
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
                        onClick={() => navigate(createPageUrl('Settings') + '?tab=admin')}
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
                            <Shield className="w-7 h-7 text-blue-600" />
                            Ticket Role Verification
                        </h1>
                        <p className="text-slate-600">Verify extension attributes for ticketing system</p>
                    </div>
                    <Button
                        onClick={fetchUserData}
                        disabled={fetching}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${fetching ? 'animate-spin' : ''}`} />
                        {fetching ? 'Loading...' : 'Fetch Data'}
                    </Button>
                </div>

                {!data ? (
                    <Card>
                        <CardContent className="p-12 text-center">
                            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">
                                Ready to Verify Extension Attributes
                            </h3>
                            <p className="text-slate-600 mb-6">
                                Click "Fetch Data" to load users with extensionAttribute1 (OSTicketRole) and extensionAttribute2 (OSDept)
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {/* Stats Cards */}
                        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                            <Card>
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-slate-600">Total Users</p>
                                            <p className="text-2xl font-bold text-slate-900">{data.stats.total}</p>
                                        </div>
                                        <Users className="w-8 h-8 text-blue-500" />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-slate-600">Workers</p>
                                            <p className="text-2xl font-bold text-green-700">{data.stats.workers}</p>
                                        </div>
                                        <UserCheck className="w-8 h-8 text-green-500" />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-slate-600">Requesters</p>
                                            <p className="text-2xl font-bold text-blue-700">{data.stats.requesters}</p>
                                        </div>
                                        <Users className="w-8 h-8 text-blue-500" />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-slate-600">Uncategorized</p>
                                            <p className="text-2xl font-bold text-orange-700">{data.stats.uncategorized}</p>
                                        </div>
                                        <UserX className="w-8 h-8 text-orange-500" />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-slate-600">Departments</p>
                                            <p className="text-2xl font-bold text-purple-700">{data.stats.departments}</p>
                                        </div>
                                        <Building2 className="w-8 h-8 text-purple-500" />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Token Source Info */}
                        <Card className="mb-6 border-green-300 bg-green-50">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                    <div>
                                        <p className="font-semibold text-green-900">Using {data.tokenSource} Token</p>
                                        <p className="text-sm text-green-700">Successfully retrieved extension attributes from Microsoft Graph</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Department Stats */}
                        {Object.keys(data.departmentStats).length > 0 && (
                            <Card className="mb-6">
                                <CardHeader>
                                    <CardTitle className="text-sm">Department Breakdown (OSDept)</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {Object.entries(data.departmentStats)
                                            .sort(([a], [b]) => a.localeCompare(b))
                                            .map(([dept, stats]) => (
                                                <div key={dept} className="p-3 bg-slate-50 rounded-lg border">
                                                    <p className="font-semibold text-slate-900">{dept}</p>
                                                    <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                                                        <p>Workers: {stats.workers}</p>
                                                        <p>Requesters: {stats.requesters}</p>
                                                        <p>Total: {stats.total}</p>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Search */}
                        <div className="mb-4">
                            <div className="relative max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    type="text"
                                    placeholder="Search by name, email, or department..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        {/* User Lists */}
                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <TabsList className="grid w-full grid-cols-4">
                                <TabsTrigger value="workers">
                                    Workers ({data.stats.workers})
                                </TabsTrigger>
                                <TabsTrigger value="requesters">
                                    Requesters ({data.stats.requesters})
                                </TabsTrigger>
                                <TabsTrigger value="uncategorized">
                                    Uncategorized ({data.stats.uncategorized})
                                </TabsTrigger>
                                <TabsTrigger value="all">
                                    All Users ({data.stats.total})
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="workers" className="mt-4">
                                <UserList users={filterUsers(data.workers)} />
                            </TabsContent>

                            <TabsContent value="requesters" className="mt-4">
                                <UserList users={filterUsers(data.requesters)} />
                            </TabsContent>

                            <TabsContent value="uncategorized" className="mt-4">
                                <UserList users={filterUsers(data.uncategorized)} />
                            </TabsContent>

                            <TabsContent value="all" className="mt-4">
                                <UserList users={filterUsers(data.allUsers)} />
                            </TabsContent>
                        </Tabs>
                    </>
                )}
            </div>
        </div>
    );
}

function UserList({ users }) {
    if (users.length === 0) {
        return (
            <Card>
                <CardContent className="p-8 text-center">
                    <p className="text-slate-500">No users found</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-2">
            {users.slice(0, 100).map((user) => (
                <Card key={user.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                                    <span className="text-white text-sm font-bold">
                                        {user.displayName?.[0]?.toUpperCase() || 'U'}
                                    </span>
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900">{user.displayName}</p>
                                    <p className="text-sm text-slate-600">{user.email}</p>
                                    {user.jobTitle && (
                                        <p className="text-xs text-slate-500">{user.jobTitle}</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {user.osTicketRole && (
                                    <Badge className={
                                        user.osTicketRole === 'worker' 
                                            ? 'bg-green-100 text-green-700' 
                                            : 'bg-blue-100 text-blue-700'
                                    }>
                                        {user.osTicketRole}
                                    </Badge>
                                )}
                                {user.osDept && (
                                    <Badge variant="outline" className="text-xs">
                                        {user.osDept}
                                    </Badge>
                                )}
                                {!user.osTicketRole && !user.osDept && (
                                    <Badge variant="outline" className="text-slate-500">
                                        No extension data
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
            {users.length > 100 && (
                <p className="text-sm text-slate-500 text-center py-4">
                    Showing first 100 of {users.length} users
                </p>
            )}
        </div>
    );
}