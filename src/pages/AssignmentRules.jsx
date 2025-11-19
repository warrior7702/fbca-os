import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Settings,
  Loader2,
  ArrowLeft,
  User,
  Users,
  Save,
  RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function AssignmentRules() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [staffMembers, setStaffMembers] = useState([]);
  const [rules, setRules] = useState({
    technology: 'billy.nelms@fbca.org',
    technical: 'billy.nelms@fbca.org',
    cleaning: 'kenny@fbca.org',
    facility_cleaning: 'kenny@fbca.org',
    maintenance: 'pool',
    facility: 'pool',
    event_setup: 'pool',
    room_setup: 'pool'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (currentUser?.role !== 'admin' && currentUser?.role !== 'super_user') {
        toast.error('Admin access required');
        navigate(createPageUrl('Settings'));
        return;
      }

      const staff = await base44.entities.StaffContact.list();
      setStaffMembers(staff);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleRuleChange = (category, value) => {
    setRules(prev => ({ ...prev, [category]: value }));
  };

  const categories = [
    { value: 'technology', label: 'Technology' },
    { value: 'technical', label: 'Technical/IT' },
    { value: 'cleaning', label: 'Cleaning' },
    { value: 'facility_cleaning', label: 'Facility Cleaning' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'facility', label: 'Facility' },
    { value: 'event_setup', label: 'Event Setup' },
    { value: 'room_setup', label: 'Room Setup' },
    { value: 'av_production', label: 'AV/Production' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'hospitality', label: 'Hospitality' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-blue-50 to-purple-50 p-3 sm:p-6 overflow-auto">
      <div className="max-w-4xl mx-auto pb-20">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl('Settings') + '?tab=admin')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
                <Settings className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600" />
                Ticket Assignment Rules
              </h1>
              <p className="text-sm text-slate-600">Configure automatic ticket assignments</p>
            </div>
          </div>
        </div>

        <Card className="border-2 border-blue-200 bg-blue-50 mb-6">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <Users className="w-6 h-6 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-blue-900 mb-1">How Auto-Assignment Works</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• <strong>Direct Assignment:</strong> Tickets are automatically assigned to specific staff members</li>
                  <li>• <strong>Pool Assignment:</strong> Tickets remain unassigned for workers to pick up</li>
                  <li>• Rules are applied when a ticket is created</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category Assignment Rules</CardTitle>
            <CardDescription>Set who should receive tickets for each category</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {categories.map(category => (
              <div key={category.value} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                    <Settings className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{category.label}</p>
                    <p className="text-xs text-slate-600">Category: {category.value}</p>
                  </div>
                </div>
                <Select 
                  value={rules[category.value] || 'pool'} 
                  onValueChange={(value) => handleRuleChange(category.value, value)}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pool">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Unassigned Pool
                      </div>
                    </SelectItem>
                    {staffMembers.map(staff => (
                      <SelectItem key={staff.email} value={staff.email}>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          {staff.full_name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Current Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-600">Direct Assignments</Badge>
                <span className="text-sm text-slate-600">
                  {Object.values(rules).filter(v => v !== 'pool').length} categories
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Pool Assignments</Badge>
                <span className="text-sm text-slate-600">
                  {Object.values(rules).filter(v => v === 'pool').length} categories
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> These rules are currently configured in the code. To persist changes, 
            update the assignment rules in <code className="bg-amber-100 px-1 rounded">functions/autoAssignTicket.js</code>
          </p>
        </div>
      </div>
    </div>
  );
}