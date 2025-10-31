import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Database, User, Key, Mail, Hash, Loader2, RefreshCw } from "lucide-react";

export default function TestCardholders() {
  const [allCardholders, setAllCardholders] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [stats, setStats] = useState({ total: 0, withEmail: 0, withMemberId: 0 });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      console.log('📥 Loading all cardholders from database...');
      const cardholders = await base44.entities.Cardholder.list();
      
      console.log('✅ Loaded:', cardholders.length, 'cardholders');
      console.log('📋 First 3 records:', cardholders.slice(0, 3));
      
      setAllCardholders(cardholders);
      
      // Calculate stats
      const withEmail = cardholders.filter(c => c.email).length;
      const withMemberId = cardholders.filter(c => c.member_id).length;
      setStats({ 
        total: cardholders.length, 
        withEmail, 
        withMemberId 
      });
      
    } catch (error) {
      console.error('❌ Failed to load:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      console.log('🔍 Searching for:', query);
      
      const response = await base44.functions.invoke('cardholdersSearch', {
        q: query,
        limit: 20
      });

      console.log('📥 Search response:', response.data);
      
      if (response.data.ok) {
        setSearchResults(response.data.results);
        console.log('✅ Found:', response.data.results.length, 'matches');
      } else {
        console.error('❌ Search failed:', response.data.error);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('❌ Search error:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const displayData = searchResults.length > 0 ? searchResults : allCardholders.slice(0, 20);

  return (
    <div className="h-full bg-gradient-to-br from-blue-50 to-slate-50 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl shadow-lg">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Test Cardholder Database</h1>
              <p className="text-slate-600">Debug & verify the cardholder data</p>
            </div>
          </div>

          <Button onClick={loadAll} disabled={loading} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Database className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                  <p className="text-sm text-slate-600">Total Records</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Mail className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stats.withEmail}</p>
                  <p className="text-sm text-slate-600">With Email</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Hash className="w-8 h-8 text-purple-600" />
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stats.withMemberId}</p>
                  <p className="text-sm text-slate-600">With Member ID</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Search className="w-8 h-8 text-orange-600" />
                <div>
                  <p className="text-2xl font-bold text-slate-900">{searchResults.length}</p>
                  <p className="text-sm text-slate-600">Search Results</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search Box */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Test Search Function</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Type name or PIN to search..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button 
                onClick={handleSearch} 
                disabled={searching || !query.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {searching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Search
                  </>
                )}
              </Button>
              {searchResults.length > 0 && (
                <Button 
                  onClick={() => {
                    setQuery("");
                    setSearchResults([]);
                  }}
                  variant="outline"
                >
                  Clear
                </Button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Press F12 to see console logs. Try: "team", "study", or any 6-digit PIN
            </p>
          </CardContent>
        </Card>

        {/* Results Header */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>
                {searchResults.length > 0 
                  ? `Search Results (${searchResults.length})`
                  : `First 20 Records (Total: ${stats.total})`
                }
              </span>
              {searchResults.length > 0 && (
                <Badge className="bg-green-100 text-green-700">
                  Search Active
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
        </Card>

        {/* Data Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="grid gap-3">
            {displayData.map((cardholder, idx) => (
              <Card key={cardholder.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    
                    <div className="flex-1 grid md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-slate-500">Name</p>
                        <p className="font-semibold text-slate-900">{cardholder.name}</p>
                      </div>
                      
                      <div>
                        <p className="text-xs text-slate-500">PIN Code</p>
                        <p className="font-mono font-semibold text-blue-600 flex items-center gap-1">
                          <Key className="w-3 h-3" />
                          {cardholder.pin}#
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-xs text-slate-500">Member ID</p>
                        <p className="text-sm text-slate-700">
                          {cardholder.member_id || <span className="text-slate-400">—</span>}
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-xs text-slate-500">Email</p>
                        <p className="text-sm text-slate-700 truncate">
                          {cardholder.email || <span className="text-slate-400">—</span>}
                        </p>
                      </div>
                    </div>

                    <Badge variant="outline" className="text-xs">
                      #{idx + 1}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && displayData.length === 0 && (
          <Card>
            <CardContent className="py-20 text-center">
              <Database className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No records found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}