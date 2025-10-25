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
          <p className="text-slate-600">Your unified workspace for First Baptist Conroe</p>
        </div>

        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <Mail className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-slate-700">
            <strong>Important:</strong> You must use your official FBCA email 
            (@fbca.org) to access FBCA OS.
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
                <p className="font-medium text-slate-900">Sign In with Your FBCA Email</p>
                <p className="text-sm text-slate-600">
                  Use your @fbca.org email address
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
                  Access Marketing, Food Service, Staff Directory, Documents, and more
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              Unauthorized Email Addresses
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-slate-600 mb-3">
              The following email types are <strong>NOT</strong> allowed:
            </p>
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
              <span>Non-FBCA organizational emails</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <XCircle className="w-4 h-4 text-red-500" />
              <span>Other church or ministry emails</span>
            </div>
            
            <Alert className="mt-4 border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-sm text-slate-700">
                FBCA OS is restricted to First Baptist Conroe staff only. Using 
                unauthorized emails will prevent access to all church systems and data.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card className="mt-6 border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-900">Need Help?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 mb-2">
              If you don't have an FBCA email address or need assistance:
            </p>
            <ul className="text-sm text-slate-600 space-y-1 ml-4">
              <li>• Contact IT Support</li>
              <li>• Reach out to your ministry leader</li>
              <li>• Email: <strong>it@fbca.org</strong></li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}