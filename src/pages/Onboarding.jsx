import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Mail, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Onboarding() {
  return (
    <div className="p-6 md:p-8 h-full overflow-auto bg-gradient-to-br from-blue-50 to-slate-50">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            Welcome to FBCA OS
          </h1>
          <p className="text-slate-600">Your unified workspace for everything FBCA</p>
        </div>

        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <Mail className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-slate-700">
            <strong>Important:</strong> Always use your FBCA Microsoft 365 email 
            (@fbca.org or @firstbaptistconroe.org) when signing in.
          </AlertDescription>
        </Alert>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Getting Started
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Badge className="bg-blue-600 mt-1">1</Badge>
              <div>
                <p className="font-medium text-slate-900">Sign In with Microsoft</p>
                <p className="text-sm text-slate-600">
                  Use your @fbca.org or @firstbaptistconroe.org email address
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Badge className="bg-blue-600 mt-1">2</Badge>
              <div>
                <p className="font-medium text-slate-900">Connect Your Services</p>
                <p className="text-sm text-slate-600">
                  Go to Settings → Integrations and connect Microsoft 365, 
                  Planning Center, and ClickUp
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Badge className="bg-blue-600 mt-1">3</Badge>
              <div>
                <p className="font-medium text-slate-900">Explore the Modules</p>
                <p className="text-sm text-slate-600">
                  Marketing, Food Service, Staff Directory, and more
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              Do NOT Use
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-slate-700">
              <XCircle className="w-4 h-4 text-red-500" />
              <span>Personal Gmail accounts</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <XCircle className="w-4 h-4 text-red-500" />
              <span>Personal Microsoft accounts</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <XCircle className="w-4 h-4 text-red-500" />
              <span>Non-FBCA email addresses</span>
            </div>
            
            <Alert className="mt-4 border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-sm text-slate-700">
                Using non-FBCA emails will prevent access to internal resources 
                and integrations.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}