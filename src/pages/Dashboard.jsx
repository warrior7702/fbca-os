import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  LayoutDashboard,
  Megaphone,
  UtensilsCrossed,
  User,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Activity,
  Zap
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

const appModules = [
  {
    name: "Marketing",
    description: "Campaign requests, asset management, and approvals",
    icon: Megaphone,
    color: "from-purple-500 to-pink-500",
    path: "Marketing",
    stats: { active: 5, pending: 2 }
  },
  {
    name: "Food Service",
    description: "Catering orders, menu planning, and inventory",
    icon: UtensilsCrossed,
    color: "from-green-500 to-emerald-500",
    path: "FoodService",
    stats: { active: 8, pending: 3 }
  },
  {
    name: "FBCA Nexts",
    description: "Personal dashboard, profile, and task management",
    icon: User,
    color: "from-orange-500 to-red-500",
    path: "FBCANexts",
    stats: { active: 12, pending: 1 }
  }
];

const recentActivity = [
  { type: "marketing", action: "New campaign request", user: "Sarah Johnson", time: "5 min ago", status: "pending" },
  { type: "food", action: "Catering order approved", user: "Mike Chen", time: "15 min ago", status: "completed" },
  { type: "nexts", action: "Profile updated", user: "You", time: "1 hour ago", status: "completed" },
  { type: "marketing", action: "Asset uploaded", user: "David Lee", time: "2 hours ago", status: "completed" },
  { type: "food", action: "Menu updated", user: "Lisa Park", time: "3 hours ago", status: "completed" }
];

export default function Dashboard() {
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

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
            Welcome back, {loading ? <Skeleton className="inline-block h-8 w-32" /> : user?.full_name?.split(' ')[0] || 'User'}! 👋
          </h1>
          <p className="text-slate-600">Here's what's happening across your organization</p>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6 mb-8"
        >
          <motion.div variants={item}>
            <Card className="border-none shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Activity className="w-8 h-8 opacity-80" />
                  <Badge variant="secondary" className="bg-white/20 text-white border-0">Live</Badge>
                </div>
                <p className="text-3xl font-bold mb-1">25</p>
                <p className="text-blue-100 text-sm">Active Tasks</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card className="border-none shadow-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Clock className="w-8 h-8 opacity-80" />
                  <TrendingUp className="w-5 h-5 opacity-80" />
                </div>
                <p className="text-3xl font-bold mb-1">6</p>
                <p className="text-purple-100 text-sm">Pending Approvals</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card className="border-none shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle2 className="w-8 h-8 opacity-80" />
                  <span className="text-green-100 text-sm">+12%</span>
                </div>
                <p className="text-3xl font-bold mb-1">89</p>
                <p className="text-green-100 text-sm">Completed This Week</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={item}>
            <Card className="border-none shadow-lg bg-gradient-to-br from-orange-500 to-orange-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Zap className="w-8 h-8 opacity-80" />
                  <Badge variant="secondary" className="bg-white/20 text-white border-0">New</Badge>
                </div>
                <p className="text-3xl font-bold mb-1">3</p>
                <p className="text-orange-100 text-sm">System Updates</p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
          {/* App Modules */}
          <div className="lg:col-span-2">
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
            >
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <LayoutDashboard className="w-5 h-5 text-blue-500" />
                Your Applications
              </h2>
              <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                {appModules.map((module) => (
                  <motion.div key={module.name} variants={item}>
                    <Link to={createPageUrl(module.path)}>
                      <Card className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-none bg-white overflow-hidden">
                        <CardHeader className={`bg-gradient-to-br ${module.color} p-6`}>
                          <div className="flex items-start justify-between">
                            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl">
                              <module.icon className="w-6 h-6 text-white" />
                            </div>
                            <ArrowRight className="w-5 h-5 text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all" />
                          </div>
                        </CardHeader>
                        <CardContent className="p-6">
                          <CardTitle className="text-lg mb-2 group-hover:text-blue-600 transition-colors">
                            {module.name}
                          </CardTitle>
                          <p className="text-sm text-slate-600 mb-4">{module.description}</p>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1">
                              <Activity className="w-4 h-4 text-green-500" />
                              <span className="text-slate-600">{module.stats.active} active</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4 text-orange-500" />
                              <span className="text-slate-600">{module.stats.pending} pending</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              Recent Activity
            </h2>
            <Card className="border-none shadow-lg">
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {recentActivity.map((activity, index) => (
                    <div key={index} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between mb-1">
                        <p className="font-medium text-sm text-slate-900">{activity.action}</p>
                        {activity.status === 'pending' ? (
                          <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mb-1">{activity.user}</p>
                      <p className="text-xs text-slate-400">{activity.time}</p>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t bg-slate-50">
                  <Button variant="ghost" className="w-full text-sm text-blue-600 hover:text-blue-700">
                    View all activity
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}