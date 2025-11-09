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

      // Get fresh token from database
      const me = await base44.auth.me();
      const users = await base44.asServiceRole.entities.User.filter({ email: me.email });
      const user = users[0];

      if (!user?.pco_access_token) {
        toast.error('No PCO token found. Please connect PCO in Settings.');
        setSearching(false);
        return;
      }

      const token = user.pco_access_token;
      const report = {
        timestamp: new Date().toISOString(),
        search_email: myEmail,
        phantom_id: '3566727',
        findings: [],
        locations: []
      };

      // SEARCH 1: Calendar /me
      console.log('📍 Checking Calendar /me...');
      try {
        const calendarMeRes = await fetch('https://api.planningcenteronline.com/calendar/v2/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (calendarMeRes.ok) {
          const calendarData = await calendarMeRes.json();
          const calendarUserId = calendarData.data?.id;
          const calendarUserEmail = calendarData.data?.attributes?.email;
          
          report.locations.push({
            endpoint: 'Calendar /me',
            status: 'success',
            user_id: calendarUserId,
            email: calendarUserEmail,
            is_phantom: calendarUserId === '3566727',
            is_you: calendarUserEmail?.toLowerCase() === myEmail.toLowerCase()
          });
          
          if (calendarUserId === '3566727') {
            report.findings.push('⚠️ PHANTOM FOUND: Calendar /me returns user ID 3566727');
          }
        }
      } catch (error) {
        report.locations.push({
          endpoint: 'Calendar /me',
          status: 'error',
          error: error.message
        });
      }

      // SEARCH 2: People /me
      console.log('📍 Checking People /me...');
      try {
        const peopleMeRes = await fetch('https://api.planningcenteronline.com/people/v2/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (peopleMeRes.ok) {
          const peopleData = await peopleMeRes.json();
          const peoplePersonId = peopleData.data?.id;
          const peopleName = peopleData.data?.attributes?.name;
          
          report.locations.push({
            endpoint: 'People /me',
            status: 'success',
            person_id: peoplePersonId,
            name: peopleName,
            is_phantom: peoplePersonId === '3566727'
          });
          
          if (peoplePersonId === '3566727') {
            report.findings.push('⚠️ PHANTOM FOUND: People /me returns person ID 3566727');
          }
        }
      } catch (error) {
        report.locations.push({
          endpoint: 'People /me',
          status: 'error',
          error: error.message
        });
      }

      // SEARCH 3: Check all approval groups
      console.log('📍 Checking Approval Groups...');
      try {
        const groupsRes = await fetch('https://api.planningcenteronline.com/calendar/v2/resource_approval_groups?per_page=100', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (groupsRes.ok) {
          const groupsData = await groupsRes.json();
          const groups = groupsData.data || [];
          
          for (const group of groups) {
            // Get people in this group
            const peopleRes = await fetch(`https://api.planningcenteronline.com/calendar/v2/resource_approval_groups/${group.id}/people?per_page=100`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (peopleRes.ok) {
              const peopleData = await peopleRes.json();
              const people = peopleData.data || [];
              
              const hasPhantom = people.some(p => p.id === '3566727');
              const hasYou = people.some(p => p.attributes?.email?.toLowerCase() === myEmail.toLowerCase());
              
              if (hasPhantom || hasYou) {
                report.locations.push({
                  endpoint: `Approval Group: ${group.attributes?.name}`,
                  status: 'success',
                  group_id: group.id,
                  has_phantom: hasPhantom,
                  has_you: hasYou,
                  people: people.map(p => ({
                    id: p.id,
                    name: p.attributes?.name,
                    email: p.attributes?.email
                  }))
                });
                
                if (hasPhantom && !hasYou) {
                  report.findings.push(`⚠️ PHANTOM FOUND: Approval group "${group.attributes?.name}" contains user 3566727 but NOT you!`);
                } else if (hasPhantom && hasYou) {
                  report.findings.push(`🔍 BOTH FOUND: Approval group "${group.attributes?.name}" contains BOTH 3566727 and you`);
                }
              }
            }
          }
        }
      } catch (error) {
        report.locations.push({
          endpoint: 'Approval Groups',
          status: 'error',
          error: error.message
        });
      }

      // SEARCH 4: Test write operation to see who it writes as
      console.log('📍 Testing write operation...');
      try {
        const testWriteRes = await fetch('https://api.planningcenteronline.com/calendar/v2/event_resource_requests/99999999', {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            data: {
              type: 'EventResourceRequest',
              id: '99999999',
              attributes: { approval_status: 'A' }
            }
          })
        });
        
        const testError = await testWriteRes.text();
        
        if (testError.includes('User with id')) {
          const match = testError.match(/User with id (\d+)/);
          if (match) {
            const writesAsUserId = match[1];
            report.locations.push({
              endpoint: 'Write Test',
              status: 'success',
              writes_as_user_id: writesAsUserId,
              is_phantom: writesAsUserId === '3566727'
            });
            
            if (writesAsUserId === '3566727') {
              report.findings.push('🚨 CRITICAL: Token performs WRITES as user 3566727!');
            }
          }
        }
      } catch (error) {
        report.locations.push({
          endpoint: 'Write Test',
          status: 'error',
          error: error.message
        });
      }

      // SEARCH 5: Search for your email in Calendar users
      console.log('📍 Searching Calendar users by email...');
      try {
        const searchRes = await fetch(`https://api.planningcenteronline.com/calendar/v2/people?where[search]=${encodeURIComponent(myEmail)}&per_page=100`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const matches = searchData.data || [];
          
          report.locations.push({
            endpoint: 'Calendar User Search',
            status: 'success',
            matches: matches.map(m => ({
              id: m.id,
              name: m.attributes?.name,
              email: m.attributes?.email,
              status: m.attributes?.status,
              is_phantom: m.id === '3566727'
            }))
          });
          
          const phantomMatch = matches.find(m => m.id === '3566727');
          if (phantomMatch) {
            report.findings.push(`⚠️ PHANTOM FOUND: User 3566727 found in Calendar with email: ${phantomMatch.attributes?.email}`);
          }
        }
      } catch (error) {
        report.locations.push({
          endpoint: 'Calendar User Search',
          status: 'error',
          error: error.message
        });
      }

      // SEARCH 6: Check OAuth token introspection
      console.log('📍 Checking OAuth token ownership...');
      try {
        const clientId = Deno.env.get('PCO_CLIENT_ID') || 'not-set';
        const clientSecret = Deno.env.get('PCO_CLIENT_SECRET') || 'not-set';
        
        if (clientId !== 'not-set' && clientSecret !== 'not-set') {
          const introspectRes = await fetch('https://api.planningcenteronline.com/oauth/introspect', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
            },
            body: `token=${token}`
          });
          
          if (introspectRes.ok) {
            const introspectData = await introspectRes.json();
            
            report.locations.push({
              endpoint: 'OAuth Introspection',
              status: 'success',
              client_id: introspectData.client_id,
              username: introspectData.username,
              active: introspectData.active
            });
            
            if (introspectData.username === '3566727') {
              report.findings.push('🚨 CRITICAL: OAuth token belongs to user 3566727!');
            }
          }
        }
      } catch (error) {
        report.locations.push({
          endpoint: 'OAuth Introspection',
          status: 'error',
          error: error.message
        });
      }

      // Generate verdict
      if (report.findings.length === 0) {
        report.verdict = {
          status: 'clean',
          message: 'No phantom user 3566727 found in any checked locations!'
        };
      } else {
        report.verdict = {
          status: 'found',
          message: `Found ${report.findings.length} instances of phantom user 3566727`,
          findings: report.findings
        };
      }

      console.log('✅ Hunt complete:', report);
      setResults(report);
      toast.success('Hunt complete! Check results below.');

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