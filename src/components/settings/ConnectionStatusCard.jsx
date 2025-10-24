import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";

export default function ConnectionStatusCard({ 
    title, 
    icon: Icon, 
    isConnected, 
    onConnect, 
    onDisconnect,
    description,
    color = "blue"
}) {
    const colorClasses = {
        blue: "bg-blue-50 border-blue-200 text-blue-700",
        purple: "bg-purple-50 border-purple-200 text-purple-700",
        orange: "bg-orange-50 border-orange-200 text-orange-700"
    };

    return (
        <Card className={`border-2 ${isConnected ? 'border-green-300' : 'border-slate-200'}`}>
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
                            <Icon className="w-6 h-6" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">{title}</CardTitle>
                            <p className="text-sm text-slate-500 mt-1">{description}</p>
                        </div>
                    </div>
                    {isConnected ? (
                        <Badge className="bg-green-100 text-green-700 border-green-300">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Connected
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="text-slate-500">
                            <XCircle className="w-3 h-3 mr-1" />
                            Not Connected
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {isConnected ? (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            <span>Active connection</span>
                        </div>
                        <Button 
                            variant="outline" 
                            size="sm"
                            onClick={onDisconnect}
                        >
                            Disconnect
                        </Button>
                    </div>
                ) : (
                    <Button 
                        onClick={onConnect}
                        className="w-full"
                    >
                        Connect {title}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}