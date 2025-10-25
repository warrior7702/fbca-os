import React, { useState, useEffect } from "react";
import { Shield, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

export default function AdminToggle({ user }) {
  const [viewAsUser, setViewAsUser] = useState(false);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    // Store view mode in session
    const savedMode = sessionStorage.getItem('viewAsUser');
    if (savedMode === 'true') {
      setViewAsUser(true);
    }
  }, []);

  const toggleView = () => {
    const newMode = !viewAsUser;
    setViewAsUser(newMode);
    sessionStorage.setItem('viewAsUser', newMode.toString());
    window.location.reload(); // Reload to apply changes
  };

  if (!isAdmin) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="fixed top-4 left-4 z-50"
    >
      <div className="bg-white rounded-xl shadow-lg border-2 border-blue-200 p-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Shield className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-slate-700">Admin Mode</p>
            <Badge variant={viewAsUser ? "secondary" : "default"} className="text-xs mt-1">
              {viewAsUser ? "Viewing as User" : "Full Admin Access"}
            </Badge>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={toggleView}
            className="flex items-center gap-2"
          >
            {viewAsUser ? (
              <>
                <Eye className="w-3 h-3" />
                Admin
              </>
            ) : (
              <>
                <EyeOff className="w-3 h-3" />
                User
              </>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}