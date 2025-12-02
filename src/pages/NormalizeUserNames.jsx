import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Users,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function NormalizeUserNames() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [applied, setApplied] = useState(false);

  const runPreview = async () => {
    setLoading(true);
    setApplied(false);
    try {
      const response = await base44.functions.invoke('normalizeUserNames', { dryRun: true });
      setResults(response.data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to preview changes');
    } finally {
      setLoading(false);
    }
  };

  const applyChanges = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('normalizeUserNames', { dryRun: false });
      setResults(response.data);
      setApplied(true);
      toast.success(`Updated ${response.data.updatedCount} user names`);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to apply changes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 to-blue-50 p-6 overflow-auto">
      <div className="max-w-4xl mx-auto pb-20">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl('Settings'))}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              Normalize User Names
            </h1>
            <p className="text-sm text-slate-600">
              Convert usernames like "andy.milliorn" to "Andy Milliorn"
            </p>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>• <strong>andy.milliorn</strong> → Andy Milliorn</p>
            <p>• <strong>billy.nelms</strong> → Billy Nelms</p>
            <p>• <strong>kyle.judkins</strong> → Kyle Judkins</p>
            <p>• <strong>warrior7702</strong> → Warrior</p>
            <p>• <strong>appy</strong> → Appy</p>
          </CardContent>
        </Card>

        <div className="flex gap-3 mb-6">
          <Button
            onClick={runPreview}
            disabled={loading}
            variant="outline"
            className="gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Preview Changes
          </Button>
          
          {results && results.updatedCount > 0 && !applied && (
            <Button
              onClick={applyChanges}
              disabled={loading}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Apply Changes ({results.updatedCount})
            </Button>
          )}
        </div>

        {results && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-slate-900">{results.totalUsers}</p>
                  <p className="text-sm text-slate-600">Total Users</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">{results.updatedCount}</p>
                  <p className="text-sm text-slate-600">{applied ? 'Updated' : 'To Update'}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{results.skippedCount}</p>
                  <p className="text-sm text-slate-600">Already Good</p>
                </CardContent>
              </Card>
            </div>

            {results.updates.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {applied ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-blue-600" />
                    )}
                    {applied ? 'Updated Users' : 'Users to Update'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {results.updates.map((update, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-sm text-slate-500">{update.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            {update.currentName}
                          </Badge>
                          <ArrowRight className="w-4 h-4 text-slate-400" />
                          <Badge className="bg-green-100 text-green-700 border-green-300">
                            {update.newName}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {results.skipped.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="w-5 h-5" />
                    Already Normalized
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {results.skipped.map((skip, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <p className="text-sm text-slate-600">{skip.email}</p>
                        <Badge className="bg-green-100 text-green-700">{skip.name}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}