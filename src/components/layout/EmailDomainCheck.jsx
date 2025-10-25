import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { AlertCircle, Mail } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export default function EmailDomainCheck({ user }) {
  const [showWarning, setShowWarning] = useState(false);
  const allowedDomains = ["fbca.org", "firstbaptistconroe.org"]; // Add your domains

  useEffect(() => {
    if (user?.email) {
      const emailDomain = user.email.split("@")[1]?.toLowerCase();
      const isAllowedDomain = allowedDomains.some(domain => emailDomain === domain.toLowerCase());
      
      if (!isAllowedDomain) {
        setShowWarning(true);
      }
    }
  }, [user]);

  const handleLogout = () => {
    base44.auth.logout();
  };

  if (!showWarning) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 bg-orange-100 rounded-xl">
            <AlertCircle className="w-6 h-6 text-orange-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Microsoft 365 Email Required
            </h3>
            <p className="text-slate-600 text-sm mb-4">
              FBCA OS requires a First Baptist Conroe Microsoft 365 email address 
              (<strong>@fbca.org</strong> or <strong>@firstbaptistconroe.org</strong>).
            </p>
            <p className="text-slate-600 text-sm mb-4">
              You're currently signed in with: <strong>{user?.email}</strong>
            </p>
            <Alert className="mb-4 border-blue-200 bg-blue-50">
              <Mail className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-slate-700">
                Please sign out and sign in using your FBCA Microsoft 365 account.
              </AlertDescription>
            </Alert>
            <Button 
              onClick={handleLogout}
              className="w-full bg-slate-900 hover:bg-slate-800"
            >
              Sign Out & Use Microsoft Email
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}