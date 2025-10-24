import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { User, Mail, Shield, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function FBCANexts() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-orange-100 rounded-xl">
            <User className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">FBCA Nexts</h1>
            <p className="text-slate-600">Your personal dashboard and profile</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-blue-500" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </>
              ) : (
                <>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Full Name</p>
                    <p className="font-medium text-slate-900">{user?.full_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Email</p>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <p className="font-medium text-slate-900">{user?.email || 'N/A'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Role</p>
                    <Badge variant="secondary" className="capitalize">
                      <Shield className="w-3 h-3 mr-1" />
                      {user?.role || 'Member'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Member Since</p>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <p className="font-medium text-slate-900">
                        {user?.created_date ? format(new Date(user.created_date), 'MMMM d, yyyy') : 'N/A'}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>My Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600">Task management features coming soon.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}