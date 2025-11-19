import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bell, Mail, Monitor, CheckCircle } from "lucide-react";

export default function NotificationPreferencesSection({ user }) {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, [user]);

  const loadPreferences = async () => {
    try {
      const prefs = await base44.entities.NotificationPreference.filter({
        user_email: user.email
      });

      if (prefs.length > 0) {
        setPreferences(prefs[0]);
      } else {
        // Create default preferences
        const defaultPrefs = {
          user_email: user.email,
          ticket_assigned_email: true,
          ticket_assigned_inapp: true,
          ticket_status_change_email: true,
          ticket_status_change_inapp: true,
          ticket_comment_email: true,
          ticket_comment_inapp: true,
          solution_provided_email: true,
          solution_provided_inapp: true,
          ticket_escalated_email: true,
          ticket_escalated_inapp: true
        };
        const created = await base44.entities.NotificationPreference.create(defaultPrefs);
        setPreferences(created);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
      toast.error('Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (field, value) => {
    setSaving(true);
    try {
      await base44.entities.NotificationPreference.update(preferences.id, {
        [field]: value
      });
      setPreferences(prev => ({ ...prev, [field]: value }));
      toast.success('Preference updated');
    } catch (error) {
      console.error('Error updating preference:', error);
      toast.error('Failed to update preference');
    } finally {
      setSaving(false);
    }
  };

  const notificationTypes = [
    {
      id: 'ticket_assigned',
      label: 'Ticket Assigned',
      description: 'When a ticket is assigned to you',
      icon: Bell
    },
    {
      id: 'ticket_status_change',
      label: 'Status Changes',
      description: 'When ticket status is updated',
      icon: CheckCircle
    },
    {
      id: 'ticket_comment',
      label: 'New Comments',
      description: 'When someone comments on your ticket',
      icon: Mail
    },
    {
      id: 'solution_provided',
      label: 'Solution Provided',
      description: 'When a solution is suggested',
      icon: CheckCircle
    },
    {
      id: 'ticket_escalated',
      label: 'Escalations',
      description: 'When a ticket needs urgent attention',
      icon: Bell
    }
  ];

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading preferences...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="font-bold text-blue-900 mb-1">Ticket Notification Preferences</h3>
              <p className="text-sm text-blue-700">
                Choose how you want to be notified about ticket updates. Changes save automatically.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Settings</CardTitle>
          <CardDescription>Configure how you receive ticket notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {notificationTypes.map((type) => {
            const Icon = type.icon;
            return (
              <div key={type.id} className="space-y-3">
                <div className="flex items-center gap-3 pb-2 border-b">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{type.label}</p>
                    <p className="text-sm text-slate-600">{type.description}</p>
                  </div>
                </div>
                
                <div className="pl-13 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-700">Email notifications</span>
                    </div>
                    <Switch
                      checked={preferences?.[`${type.id}_email`] ?? true}
                      onCheckedChange={(checked) => updatePreference(`${type.id}_email`, checked)}
                      disabled={saving}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-700">In-app notifications</span>
                    </div>
                    <Switch
                      checked={preferences?.[`${type.id}_inapp`] ?? true}
                      onCheckedChange={(checked) => updatePreference(`${type.id}_inapp`, checked)}
                      disabled={saving}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Email Enabled</p>
                <p className="text-xs text-slate-600">
                  {Object.keys(preferences || {}).filter(k => k.endsWith('_email') && preferences[k]).length} / 5
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Monitor className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium">In-App Enabled</p>
                <p className="text-xs text-slate-600">
                  {Object.keys(preferences || {}).filter(k => k.endsWith('_inapp') && preferences[k]).length} / 5
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}