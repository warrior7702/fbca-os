import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function MicrosoftLogin() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Checking authentication...");
  const [error, setError] = useState(null);

  useEffect(() => {
    handleAuth();
  }, []);

  const handleAuth = async () => {
    try {
      // Check if user is already authenticated
      const isAuth = await base44.auth.isAuthenticated();
      
      if (isAuth) {
        // Already logged in, go to dashboard
        navigate(createPageUrl("Dashboard"));
        return;
      }

      // Check for code in URL (OAuth callback)
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (!code) {
        // No code, initiate Microsoft login
        setStatus("Redirecting to Microsoft...");
        await initiateMicrosoftLogin();
      } else {
        // Have code, complete authentication
        setStatus("Completing sign in...");
        await completeMicrosoftLogin(code);
      }
    } catch (err) {
      console.error("Auth error:", err);
      setError(err.message);
    }
  };

  const initiateMicrosoftLogin = async () => {
    const tenantId = "common"; // or your specific tenant ID
    const clientId = "YOUR_CLIENT_ID"; // Replace with your client ID
    const redirectUri = encodeURIComponent(window.location.origin + "/MicrosoftLogin");
    const scope = encodeURIComponent("openid profile email User.Read offline_access");
    const state = Math.random().toString(36).substring(7);
    
    // Store state for verification
    sessionStorage.setItem("ms_auth_state", state);

    const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
      `client_id=${clientId}&` +
      `response_type=code&` +
      `redirect_uri=${redirectUri}&` +
      `scope=${scope}&` +
      `state=${state}&` +
      `response_mode=query`;

    window.location.href = authUrl;
  };

  const completeMicrosoftLogin = async (code) => {
    // This would need a backend function to exchange code for tokens
    // and create/login the user in Base44
    const response = await base44.functions.invoke("completeMicrosoftSSO", { code });
    
    if (response.data.success) {
      navigate(createPageUrl("Dashboard"));
    } else {
      setError("Failed to complete login");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-2xl p-4">
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fb9a0b2d7d369a37662cca/0bf40efc2_FBCA_AppIcon_Ryl_web.png"
            alt="FBCA Logo"
            className="w-full h-full object-contain"
          />
        </div>

        {error ? (
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">Sign In Failed</h2>
            <p className="text-red-400 mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div>
            <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
            <p className="text-white text-lg">{status}</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}