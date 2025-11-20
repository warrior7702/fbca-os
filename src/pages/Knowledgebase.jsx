import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Book,
  ArrowLeft,
  Search,
  Loader2,
  Users,
  Key,
  Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function Knowledgebase() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [cardholders, setCardholders] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Load door codes
      const doorCodes = await base44.entities.Cardholder.list();
      setCardholders(doorCodes);
    } catch (error) {
      console.error('Failed to load knowledgebase:', error);
      toast.error('Failed to load knowledgebase');
    } finally {
      setLoading(false);
    }
  };

  const filteredCardholders = cardholders.filter(ch => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      ch.name?.toLowerCase().includes(query) ||
      ch.pin?.includes(query) ||
      ch.email?.toLowerCase().includes(query) ||
      ch.member_id?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-blue-50 to-indigo-50 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl('Dashboard'))}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Book className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Knowledgebase</h1>
                <p className="text-sm text-slate-600">Reference information for ticket resolution</p>
              </div>
            </div>
          </div>
        </div>

        {/* Door Codes Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Door Codes Database
              <Badge variant="secondary" className="ml-2">
                {cardholders.length} codes
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search by name, pin, email, or member ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-slate-700">
                  <p className="font-medium mb-1">Quick Reference:</p>
                  <p>Use this database to validate door codes when users request access or report door code issues. All codes are synced from Planning Center.</p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left p-3 text-sm font-semibold text-slate-700">Name</th>
                    <th className="text-left p-3 text-sm font-semibold text-slate-700">Door Code (PIN)</th>
                    <th className="text-left p-3 text-sm font-semibold text-slate-700">Email</th>
                    <th className="text-left p-3 text-sm font-semibold text-slate-700">Member ID</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCardholders.map((ch) => (
                    <tr key={ch.id} className="border-b border-slate-100 hover:bg-white transition-colors">
                      <td className="p-3 text-sm text-slate-900">{ch.name}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="font-mono text-blue-700 bg-blue-50">
                          {ch.pin}
                        </Badge>
                      </td>
                      <td className="p-3 text-sm text-slate-600">{ch.email || '-'}</td>
                      <td className="p-3 text-sm text-slate-600">{ch.member_id || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredCardholders.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No door codes found matching "{searchQuery}"</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Placeholder for future sections */}
        <Card className="border-dashed border-2">
          <CardContent className="p-8 text-center">
            <Book className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500">More knowledgebase articles coming soon...</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}