import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, AlertCircle, CheckCircle, XCircle, User, Users, Calendar, Shield } from "lucide-react";
import { toast } from "sonner";

export default function PhantomUserHunter() {
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [myEmail, setMyEmail] = useState("");

  const huntPhantomUser = async () => {
    if (!myEmail.trim()) {
      toast.error("Please enter your PCO email address");
      return;
    }

    setSearching(true);
    setResults(null);

    try {
      console.log('🔍 Starting Phantom User Hunt for:', myEmail);

      const response = await base44.functions.invoke('huntPhantomUser', {
        search_email: myEmail
      });

      if (response.data.ok) {
        setResults(response.data.report);
        toast.success('Hunt complete! Check results below.');
      } else {
        throw new Error(response.data.error || 'Hunt failed');
      }

    } catch (error) {
      console.error('❌ Hunt error:', error);
      toast.error('Hunt failed: ' + error.message);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 to-gray-50 p-6 overflow-auto">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl shadow-lg">
            <Search className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Phantom User Hunter</h1>
            <p className="text-slate-600">Track down user ID 3566727 across all PCO systems</p>
          </div>
        </div>

        {/* Search Form */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Start the Hunt</CardTitle>
            <CardDescription>
              Enter your PCO email to search for the phantom user 3566727 and compare it with your actual user IDs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Your PCO Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="billy.nelms@fbca.org"
                  value={myEmail}
                  onChange={(e) => setMyEmail(e.target.value)}
                  className="mt-2"
                />
              </div>

              <Button 
                onClick={huntPhantomUser} 
                disabled={searching}
                className="w-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
              >
                {searching ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Hunting...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Hunt Phantom User
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {results && (
          <div className="space-y-4">
            {/* Verdict */}
            <Card className={`border-2 ${
              results.verdict.status === 'found' 
                ? 'border-red-300 bg-red-50' 
                : 'border-green-300 bg-green-50'
            }`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {results.verdict.status === 'found' ? (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}
                  Hunt Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Alert className={results.verdict.status === 'found' ? 'bg-red-100 border-red-300' : 'bg-green-100 border-green-300'}>
                    <AlertDescription className="font-semibold">
                      {results.verdict.message}
                    </AlertDescription>
                  </Alert>

                  {results.findings.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <h4 className="font-semibold text-slate-900">Critical Findings:</h4>
                      {results.findings.map((finding, idx) => (
                        <div key={idx} className="p-3 bg-white rounded border border-red-200">
                          <p className="text-sm">{finding}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* All Locations Checked */}
            <Card>
              <CardHeader>
                <CardTitle>All Locations Checked</CardTitle>
                <CardDescription>Every place we searched for user 3566727</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {results.locations.map((location, idx) => (
                    <Card key={idx} className="bg-slate-50">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {location.status === 'success' ? (
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                            )}
                            <h4 className="font-semibold text-slate-900">{location.endpoint}</h4>
                          </div>
                          
                          {location.is_phantom && (
                            <Badge className="bg-red-500 text-white">PHANTOM FOUND</Badge>
                          )}
                        </div>

                        <div className="ml-6 space-y-2 text-sm">
                          {location.user_id && (
                            <div className="flex items-center gap-2">
                              <User className="w-3 h-3 text-slate-400" />
                              <span>User ID: <code className="font-mono bg-slate-200 px-2 py-0.5 rounded">{location.user_id}</code></span>
                              {location.is_phantom && <Badge variant="outline" className="text-xs">This is 3566727!</Badge>}
                            </div>
                          )}

                          {location.person_id && (
                            <div className="flex items-center gap-2">
                              <User className="w-3 h-3 text-slate-400" />
                              <span>Person ID: <code className="font-mono bg-slate-200 px-2 py-0.5 rounded">{location.person_id}</code></span>
                            </div>
                          )}

                          {location.writes_as_user_id && (
                            <div className="flex items-center gap-2">
                              <Shield className="w-3 h-3 text-slate-400" />
                              <span>Writes as: <code className="font-mono bg-slate-200 px-2 py-0.5 rounded">{location.writes_as_user_id}</code></span>
                              {location.is_phantom && <Badge variant="outline" className="text-xs bg-red-100">PROBLEM!</Badge>}
                            </div>
                          )}

                          {location.email && (
                            <div className="flex items-center gap-2 flex-wrap">
                              <span>Email: {location.email}</span>
                              {location.is_you && <Badge className="bg-blue-500">This is you!</Badge>}
                            </div>
                          )}

                          {location.people && (
                            <div className="mt-2 p-2 bg-white rounded border">
                              <p className="text-xs font-semibold mb-1">Group Members:</p>
                              <div className="space-y-1">
                                {location.people.map((person, pidx) => (
                                  <div key={pidx} className="flex items-center gap-2 text-xs">
                                    <Users className="w-3 h-3 text-slate-400" />
                                    <span>{person.name} ({person.id})</span>
                                    {person.id === '3566727' && <Badge className="bg-red-500 text-white text-xs">PHANTOM</Badge>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {location.matches && (
                            <div className="mt-2 p-2 bg-white rounded border">
                              <p className="text-xs font-semibold mb-1">Search Results ({location.matches.length}):</p>
                              <div className="space-y-1">
                                {location.matches.map((match, midx) => (
                                  <div key={midx} className="flex items-center gap-2 text-xs">
                                    <User className="w-3 h-3 text-slate-400" />
                                    <span>{match.name} - {match.email} (ID: {match.id})</span>
                                    {match.is_phantom && <Badge className="bg-red-500 text-white text-xs">PHANTOM</Badge>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {location.error && (
                            <p className="text-red-600 text-xs">{location.error}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}