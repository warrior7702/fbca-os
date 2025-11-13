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
    RefreshCw,
    Eye,
    Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
                        <p className="text-slate-600">Verify Entra ID extension attributes for ticketing system</p>
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

                {/* Info Alert */}
                <Alert className="mb-6 border-blue-200 bg-blue-50">
                    <Info className="w-4 h-4 text-blue-600" />
                    <AlertDescription className="text-sm text-blue-900">
                        <div className="space-y-1">
                            <p><strong>extensionAttribute1 (OSTicketRole):</strong> "worker" = can be assigned tickets | "viewer" = read-only access</p>
                            <p><strong>extensionAttribute2 (OSDept):</strong> Department classification (Admin, Kitchen, Comms, etc.)</p>
                        </div>
                    </AlertDescription>
                </Alert>

                {!data ? (
                    <Card>
                        <CardContent className="p-12 text-center">
                            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">
                                Ready to Verify Extension Attributes
                            </h3>
                            <p className="text-slate-600 mb-6">
                                Click "Fetch Data" to load users from Microsoft Entra ID
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
                                            <p className="text-xs text-slate-500 mb-1">(Assignable)</p>
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
                                            <p className="text-sm text-slate-600">Viewers</p>
                                            <p className="text-xs text-slate-500 mb-1">(Read-only)</p>
                                            <p className="text-2xl font-bold text-blue-700">{data.stats.viewers}</p>
                                        </div>
                                        <Eye className="w-8 h-8 text-blue-500" />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-slate-600">No Role Set</p>
                                            <p className="text-xs text-slate-500 mb-1">(extensionAttribute1)</p>
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
                                            <p className="text-xs text-slate-500 mb-1">(extensionAttribute2)</p>
                                            <p className="text-2xl font-bold text-purple-700">{data.stats.departments.length}</p>
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
                                        <p className="text-sm text-green-700">Successfully retrieved onPremisesExtensionAttributes from Microsoft Graph</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Department List (OSDept values) */}
                        {data.departmentList && data.departmentList.length > 0 && (
                            <Card className="mb-6">
                                <CardHeader>
                                    <CardTitle className="text-sm flex items-center gap-2">
                                        <Building2 className="w-4 h-4" />
                                        Departments Found (extensionAttribute2 / OSDept)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-wrap gap-2">
                                        {data.departmentList.map((dept) => (
                                            <Badge key={dept} variant="outline" className="text-xs px-3 py-1">
                                                {dept}
                                            </Badge>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Department Stats Breakdown */}
                        {Object.keys(data.departmentStats).length > 0 && (
                            <Card className="mb-6">
                                <CardHeader>
                                    <CardTitle className="text-sm">Department Breakdown (Workers vs Viewers per Department)</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {Object.entries(data.departmentStats)
                                            .sort(([a], [b]) => a.localeCompare(b))
                                            .map(([dept, stats]) => (
                                                <div key={dept} className="p-3 bg-slate-50 rounded-lg border">
                                                    <p className="font-semibold text-slate-900 mb-2">{dept}</p>
                                                    <div className="text-xs text-slate-600 space-y-1">
                                                        <div className="flex items-center justify-between">
                                                            <span className="flex items-center gap-1">
                                                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                                Workers:
                                                            </span>
                                                            <span className="font-semibold">{stats.workers}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <span className="flex items-center gap-1">
                                                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                                                Viewers:
                                                            </span>
                                                            <span className="font-semibold">{stats.viewers}</span>
                                                        </div>
                                                        {stats.noRole > 0 && (
                                                            <div className="flex items-center justify-between">
                                                                <span className="flex items-center gap-1">
                                                                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                                                                    No role:
                                                                </span>
                                                                <span className="font-semibold">{stats.noRole}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex items-center justify-between border-t pt-1 mt-1">
                                                            <span>Total:</span>
                                                            <span className="font-bold">{stats.total}</span>
                                                        </div>
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
                                    <UserCheck className="w-4 h-4 mr-2" />
                                    Workers ({data.stats.workers})
                                </TabsTrigger>
                                <TabsTrigger value="viewers">
                                    <Eye className="w-4 h-4 mr-2" />
                                    Viewers ({data.stats.viewers})
                                </TabsTrigger>
                                <TabsTrigger value="uncategorized">
                                    <UserX className="w-4 h-4 mr-2" />
                                    No Role ({data.stats.uncategorized})
                                </TabsTrigger>
                                <TabsTrigger value="all">
                                    <Users className="w-4 h-4 mr-2" />
                                    All ({data.stats.total})
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="workers" className="mt-4">
                                <UserList users={filterUsers(data.workers)} />
                            </TabsContent>

                            <TabsContent value="viewers" className="mt-4">
                                <UserList users={filterUsers(data.viewers)} />
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
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                                    <span className="text-white text-sm font-bold">
                                        {user.displayName?.[0]?.toUpperCase() || 'U'}
                                    </span>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-slate-900 truncate">{user.displayName}</p>
                                    <p className="text-sm text-slate-600 truncate">{user.email}</p>
                                    {user.jobTitle && (
                                        <p className="text-xs text-slate-500 truncate">{user.jobTitle}</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                                {user.osTicketRole ? (
                                    <Badge className={
                                        user.osTicketRole === 'worker' 
                                            ? 'bg-green-100 text-green-700 border border-green-300' 
                                            : 'bg-blue-100 text-blue-700 border border-blue-300'
                                    }>
                                        {user.osTicketRole === 'worker' ? (
                                            <><UserCheck className="w-3 h-3 mr-1" /> Worker</>
                                        ) : (
                                            <><Eye className="w-3 h-3 mr-1" /> Viewer</>
                                        )}
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="text-orange-600 border-orange-300">
                                        <UserX className="w-3 h-3 mr-1" />
                                        No Role
                                    </Badge>
                                )}
                                {user.osDept ? (
                                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
                                        <Building2 className="w-3 h-3 mr-1" />
                                        {user.osDept}
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="text-slate-400">
                                        No Dept
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