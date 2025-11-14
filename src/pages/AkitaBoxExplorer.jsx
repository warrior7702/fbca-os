import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Building2,
  Loader2,
  ArrowLeft,
  MapPin,
  FileText,
  Wrench,
  Image,
  Download,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Clock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

export default function AkitaBoxExplorer() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const capabilities = [
    {
      id: "buildings",
      name: "Buildings & Rooms",
      icon: Building2,
      color: "from-blue-500 to-cyan-600",
      description: "Browse buildings, floors, rooms, and spaces",
      status: "active",
      path: "AkitaFetch"
    },
    {
      id: "assets",
      name: "Asset Management",
      icon: Wrench,
      color: "from-purple-500 to-pink-600",
      description: "Track equipment, HVAC, electrical, and more",
      status: "active",
      path: "AkitaFetch"
    },
    {
      id: "floorplans",
      name: "Floor Plans",
      icon: MapPin,
      color: "from-green-500 to-emerald-600",
      description: "View interactive floor plans with asset locations",
      status: "coming_soon"
    },
    {
      id: "workorders",
      name: "Work Orders",
      icon: FileText,
      color: "from-orange-500 to-red-600",
      description: "View and create maintenance work orders",
      status: "coming_soon"
    },
    {
      id: "documents",
      name: "Documents",
      icon: Image,
      color: "from-indigo-500 to-purple-600",
      description: "Access building documents and asset manuals",
      status: "coming_soon"
    }
  ];

  const handleCardClick = (capability) => {
    if (capability.status === "active" && capability.path) {
      navigate(createPageUrl(capability.path));
    } else {
      toast.info(`${capability.name} - Coming Soon!`);
    }
  };

  const akitaBoxInfo = {
    org_id: "60ad1f92eae3d10661be97fb",
    url: "https://fbca.akitabox.com",
    api_docs: "https://api.akitabox.com/docs"
  };

  return (
    <div className="h-full bg-gradient-to-br from-blue-50 to-cyan-50 p-3 sm:p-6 overflow-auto">
      <div className="max-w-6xl mx-auto pb-20">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl('Dashboard'))}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68fb9a0b2d7d369a37662cca/af69470b7_akitafetch_hybrid_64x64.png"
              alt="AkitaBox"
              className="w-10 h-10"
            />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                AkitaBox Integration
              </h1>
              <p className="text-sm text-slate-600">Explore building management capabilities</p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">
              <Building2 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="info">
              <AlertCircle className="w-4 h-4 mr-2" />
              Integration Info
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card className="border-2 border-blue-200 bg-blue-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">
                      FBCA Building Management System
                    </h3>
                    <p className="text-sm text-slate-700 mb-4">
                      AkitaBox integration provides access to building information, asset tracking, 
                      floor plans, work orders, and maintenance documentation for First Baptist Church of Atlanta.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-green-100 text-green-700 border-green-300">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Connected
                      </Badge>
                      <Badge variant="outline">
                        Organization: FBCA
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              {capabilities.map((capability) => (
                <Card
                  key={capability.id}
                  className={`cursor-pointer hover:shadow-lg transition-all ${
                    capability.status === "coming_soon" ? "opacity-75" : ""
                  }`}
                  onClick={() => handleCardClick(capability)}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 bg-gradient-to-br ${capability.color} rounded-xl flex items-center justify-center`}>
                        <capability.icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{capability.name}</CardTitle>
                        {capability.status === "active" ? (
                          <Badge className="bg-green-100 text-green-700 border-green-300 mt-1">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge className="bg-orange-100 text-orange-700 border-orange-300 mt-1">
                            <Clock className="w-3 h-3 mr-1" />
                            Coming Soon
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600">{capability.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="w-5 h-5" />
                  Quick Links
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <a
                  href={akitaBoxInfo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <span className="font-medium text-slate-900">AkitaBox Dashboard</span>
                  <ExternalLink className="w-4 h-4 text-slate-600" />
                </a>
                <a
                  href={akitaBoxInfo.api_docs}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <span className="font-medium text-slate-900">API Documentation</span>
                  <ExternalLink className="w-4 h-4 text-slate-600" />
                </a>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="info" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Integration Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-1">Organization ID</p>
                  <code className="text-xs bg-slate-100 px-2 py-1 rounded">
                    {akitaBoxInfo.org_id}
                  </code>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-1">AkitaBox URL</p>
                  <a
                    href={akitaBoxInfo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {akitaBoxInfo.url}
                  </a>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-1">Authentication</p>
                  <p className="text-sm text-slate-600">JWT Token (Configured)</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Available Data</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    Buildings and building groups
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    Floors and levels
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    Rooms and spaces
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    Assets and equipment
                  </li>
                  <li className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-orange-600" />
                    Floor plans (Coming Soon)
                  </li>
                  <li className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-orange-600" />
                    Work orders (Coming Soon)
                  </li>
                  <li className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-orange-600" />
                    Documents & manuals (Coming Soon)
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                <p className="font-semibold mb-2">Integration Capabilities</p>
                <p className="text-sm">
                  The AkitaBox integration currently supports read-only access to building data. 
                  Future updates will enable work order creation, document uploads, and real-time updates.
                </p>
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}