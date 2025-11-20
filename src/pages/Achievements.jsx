import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Trophy,
  Star,
  Zap,
  Target,
  Award,
  Crown,
  Sparkles,
  Lock,
  CheckCircle2,
  TrendingUp,
  Calendar,
  Users,
  MessageSquare,
  ListChecks,
  ClipboardCheck,
  Loader2,
  ArrowLeft,
  Medal,
  Flame
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import ConfettiCelebration from "../components/achievements/ConfettiCelebration";

const ICON_MAP = {
  Trophy, Star, Zap, Target, Award, Crown, Sparkles, CheckCircle2,
  TrendingUp, Calendar, Users, MessageSquare, ListChecks, ClipboardCheck,
  Medal, Flame
};

const RARITY_COLORS = {
  common: { bg: "from-slate-400 to-slate-500", text: "text-slate-700", border: "border-slate-300" },
  rare: { bg: "from-blue-400 to-blue-600", text: "text-blue-700", border: "border-blue-300" },
  epic: { bg: "from-purple-400 to-purple-600", text: "text-purple-700", border: "border-purple-300" },
  legendary: { bg: "from-amber-400 to-yellow-500", text: "text-amber-700", border: "border-amber-300" }
};

export default function Achievements() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [achievements, setAchievements] = useState([]);
  const [userAchievements, setUserAchievements] = useState([]);
  const [stats, setStats] = useState({ total: 0, unlocked: 0, points: 0 });
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showUnlockedAnimation, setShowUnlockedAnimation] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Load all achievements
      const allAchievements = await base44.entities.Achievement.list();
      setAchievements(allAchievements);

      // Load user's progress
      const userProgress = await base44.entities.UserAchievement.filter({
        user_email: currentUser.email
      });
      setUserAchievements(userProgress);

      // Calculate stats
      const unlockedCount = userProgress.filter(ua => ua.unlocked).length;
      const totalPoints = userProgress
        .filter(ua => ua.unlocked)
        .reduce((sum, ua) => {
          const achievement = allAchievements.find(a => a.id === ua.achievement_id);
          return sum + (achievement?.points || 0);
        }, 0);

      setStats({
        total: allAchievements.length,
        unlocked: unlockedCount,
        points: totalPoints
      });

      // Check for any newly unlocked achievements
      checkForNewUnlocks(currentUser.email);

    } catch (error) {
      console.error("Error loading achievements:", error);
      toast.error("Failed to load achievements");
    } finally {
      setLoading(false);
    }
  };

  const checkForNewUnlocks = async (email) => {
    try {
      const response = await base44.functions.invoke('checkAchievements', { 
        user_email: email 
      });
      
      if (response.data.newlyUnlocked && response.data.newlyUnlocked.length > 0) {
        // Show notification for first newly unlocked achievement
        const newAchievement = response.data.newlyUnlocked[0];
        setShowUnlockedAnimation(newAchievement);
        setShowConfetti(true);
        
        setTimeout(() => {
          setShowUnlockedAnimation(null);
          setShowConfetti(false);
        }, 5000);
        
        // Reload data to show updated progress
        await loadData();
      }
    } catch (error) {
      console.error("Error checking achievements:", error);
    }
  };

  const getUserProgress = (achievementId) => {
    return userAchievements.find(ua => ua.achievement_id === achievementId);
  };

  const getProgressPercentage = (achievement, userProgress) => {
    if (!userProgress || !achievement.requirement_value) return 0;
    return Math.min((userProgress.progress / achievement.requirement_value) * 100, 100);
  };

  const filteredAchievements = selectedCategory === "all" 
    ? achievements 
    : achievements.filter(a => a.category === selectedCategory);

  const categories = [
    { id: "all", label: "All", icon: Trophy },
    { id: "tasks", label: "Tasks", icon: ListChecks },
    { id: "approvals", label: "Approvals", icon: ClipboardCheck },
    { id: "collaboration", label: "Team", icon: Users },
    { id: "events", label: "Events", icon: Calendar },
    { id: "speed", label: "Speed", icon: Zap },
    { id: "special", label: "Special", icon: Crown }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-amber-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading achievements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 overflow-auto">
      <ConfettiCelebration show={showConfetti} />
      <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-6 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl('Dashboard'))}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-amber-500 to-yellow-500 rounded-xl shadow-lg">
                <Trophy className="w-7 h-7 text-white" />
              </div>
              Achievements
            </h1>
            <p className="text-slate-600">Track your progress and unlock rewards</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-2 border-amber-200 bg-gradient-to-br from-white to-amber-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Trophy className="w-8 h-8 text-amber-600" />
                <Badge className="bg-amber-100 text-amber-700 border-amber-300">
                  {stats.unlocked}/{stats.total}
                </Badge>
              </div>
              <p className="text-2xl font-bold text-slate-900">{stats.unlocked}</p>
              <p className="text-sm text-slate-600">Achievements Unlocked</p>
              <Progress 
                value={(stats.unlocked / stats.total) * 100} 
                className="mt-3 h-2"
              />
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-200 bg-gradient-to-br from-white to-blue-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Star className="w-8 h-8 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{stats.points}</p>
              <p className="text-sm text-slate-600">Total Points</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-purple-200 bg-gradient-to-br from-white to-purple-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Zap className="w-8 h-8 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {Math.round((stats.unlocked / stats.total) * 100)}%
              </p>
              <p className="text-sm text-slate-600">Completion Rate</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-pink-200 bg-gradient-to-br from-white to-pink-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Crown className="w-8 h-8 text-pink-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900">
                #{Math.floor(Math.random() * 50) + 1}
              </p>
              <p className="text-sm text-slate-600">Leaderboard Rank</p>
            </CardContent>
          </Card>
        </div>

        {/* Category Tabs */}
        <Card>
          <CardContent className="p-6">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {categories.map(cat => {
                const Icon = cat.icon;
                const isActive = selectedCategory === cat.id;
                return (
                  <Button
                    key={cat.id}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={isActive ? "bg-amber-600 hover:bg-amber-700" : ""}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {cat.label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Achievement Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAchievements.map((achievement) => {
            const userProgress = getUserProgress(achievement.id);
            const isUnlocked = userProgress?.unlocked || false;
            const progress = getProgressPercentage(achievement, userProgress);
            const Icon = ICON_MAP[achievement.icon] || Trophy;
            const rarityStyle = RARITY_COLORS[achievement.rarity];

            return (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.02 }}
                className="relative"
              >
                <Card className={`relative overflow-hidden border-2 ${
                  isUnlocked 
                    ? `${rarityStyle.border} bg-gradient-to-br from-white to-${achievement.rarity === 'legendary' ? 'amber' : achievement.rarity === 'epic' ? 'purple' : achievement.rarity === 'rare' ? 'blue' : 'slate'}-50` 
                    : 'border-slate-200 bg-slate-50'
                }`}>
                  {isUnlocked && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-green-500 text-white border-0">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Unlocked
                      </Badge>
                    </div>
                  )}
                  
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4 mb-4">
                      <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${
                        isUnlocked 
                          ? `bg-gradient-to-br ${rarityStyle.bg} shadow-lg` 
                          : 'bg-slate-200'
                      }`}>
                        {isUnlocked ? (
                          <Icon className="w-8 h-8 text-white" />
                        ) : (
                          <Lock className="w-8 h-8 text-slate-400" />
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <h3 className={`font-bold text-lg mb-1 ${
                          isUnlocked ? 'text-slate-900' : 'text-slate-500'
                        }`}>
                          {achievement.is_hidden && !isUnlocked ? '???' : achievement.name}
                        </h3>
                        <Badge variant="outline" className={`text-xs ${rarityStyle.text}`}>
                          {achievement.rarity.toUpperCase()}
                        </Badge>
                      </div>
                    </div>

                    <p className={`text-sm mb-4 ${
                      isUnlocked ? 'text-slate-700' : 'text-slate-500'
                    }`}>
                      {achievement.is_hidden && !isUnlocked 
                        ? 'Hidden achievement - unlock to reveal!' 
                        : achievement.description}
                    </p>

                    {!isUnlocked && userProgress && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm text-slate-600">
                          <span>Progress</span>
                          <span className="font-semibold">
                            {userProgress.progress}/{achievement.requirement_value}
                          </span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
                      <div className="flex items-center gap-1 text-amber-600">
                        <Star className="w-4 h-4 fill-current" />
                        <span className="font-bold">{achievement.points}</span>
                        <span className="text-xs text-slate-600">pts</span>
                      </div>
                      
                      {isUnlocked && userProgress?.unlocked_at && (
                        <span className="text-xs text-slate-500">
                          Unlocked {new Date(userProgress.unlocked_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {filteredAchievements.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Trophy className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                No achievements in this category yet
              </h3>
              <p className="text-slate-600">
                Try selecting a different category
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Unlock Animation */}
      <AnimatePresence>
        {showUnlockedAnimation && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: -50 }}
            className="fixed top-24 right-6 z-50 max-w-sm"
          >
            <Card className="border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-yellow-100 shadow-2xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl flex items-center justify-center shadow-lg">
                    <Trophy className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-amber-600 uppercase mb-1">
                      Achievement Unlocked!
                    </p>
                    <h3 className="font-bold text-slate-900">{showUnlockedAnimation.name}</h3>
                    <p className="text-sm text-slate-600 mt-1">
                      +{showUnlockedAnimation.points} points
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}