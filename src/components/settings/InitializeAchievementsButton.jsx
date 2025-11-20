import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Trophy, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function InitializeAchievementsButton() {
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const handleInitialize = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('initializeAchievements');
      
      if (response.data.success) {
        setInitialized(true);
        toast.success(
          `🎉 ${response.data.message}! Created ${response.data.breakdown.common} common, ${response.data.breakdown.rare} rare, ${response.data.breakdown.epic} epic, and ${response.data.breakdown.legendary} legendary achievements!`
        );
      } else {
        throw new Error(response.data.error || 'Failed to initialize');
      }
    } catch (error) {
      console.error('Error initializing achievements:', error);
      toast.error('Failed to initialize achievements: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (initialized) {
    return (
      <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
        <CheckCircle className="w-5 h-5 text-green-600" />
        <span className="text-sm text-green-800 font-medium">
          Achievements initialized! Users can now view them at /achievements
        </span>
      </div>
    );
  }

  return (
    <Button 
      onClick={handleInitialize} 
      disabled={loading}
      className="bg-amber-600 hover:bg-amber-700"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Initializing...
        </>
      ) : (
        <>
          <Trophy className="w-4 h-4 mr-2" />
          Initialize Achievements System
        </>
      )}
    </Button>
  );
}