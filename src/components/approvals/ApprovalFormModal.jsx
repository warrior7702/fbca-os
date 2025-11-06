
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Calendar, Clock, MapPin, Search, CheckCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent } from "@/components/ui/card";
// Alert and AlertDescription are imported in the outline but not used in the provided JSX.
// However, the instruction is to implement *all* changes from the outline.
// So, I will include their imports as per the outline.
import { Alert, AlertDescription } from "@/components/ui/alert"; 
import CardholderLookup from "./CardholderLookup";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

export default function ApprovalFormModal({ open, onOpenChange, approval, onSubmit }) {
  const [formData, setFormData] = useState({
    access_type: 'door_code',
    entrance: '',
    badge_code: '',
    start_time: '',
    end_time: '',
    buildings: [],
    doors: '',
    notes: '',
    requestor_email: '',
    schedule: '',
    personnel: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [showCardholderLookup, setShowCardholderLookup] = useState(false);

  useEffect(() => {
    if (open && approval) {
      // Reset formData to default values when the modal opens or approval changes
      setFormData({
        access_type: 'door_code',
        entrance: '',
        badge_code: '',
        start_time: '',
        end_time: '',
        buildings: [],
        doors: '',
        notes: '',
        requestor_email: '',
        schedule: '',
        personnel: ''
      });
    }
  }, [open, approval]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.access_type === 'door_code') {
      if (!formData.badge_code) {
        toast.error('Please provide a door code');
        return;
      }

      // Format badge code to ensure it ends with # and has 6 digits
      let badgeCode = formData.badge_code.replace(/#/g, '').trim(); // Remove any existing #
      
      // Validate it's 6 digits
      if (!/^\d{6}$/.test(badgeCode)) {
        toast.error('Door code must be exactly 6 digits');
        return;
      }

      // Add the # at the end
      badgeCode = badgeCode + '#';

      setSubmitting(true);
      try {
        await onSubmit({
          ...formData,
          badge_code: badgeCode // Ensure format is xxxxxx#
        });
        toast.success('Request approved and task created!');
      } catch (error) {
        console.error('Submit error:', error);
        toast.error('Failed to submit approval');
      } finally {
        setSubmitting(false);
      }
    } else { // Staff Unlock scenario
      setSubmitting(true);
      try {
        await onSubmit({
          ...formData,
          badge_code: null // No badge code for staff unlock
        });
        toast.success('Request approved and task created for staff unlock!');
      } catch (error) {
        console.error('Submit error:', error);
        toast.error('Failed to submit approval');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleCardholderSelect = (cardholder) => {
    // Format the PIN to xxxxxx# format
    const pin = String(cardholder.pin).replace(/#/g, '').trim(); // Ensure pin is string before replace
    setFormData({
      ...formData,
      badge_code: pin, // Store as 6 digits, # will be added on submit if needed
      requestor_email: cardholder.email || formData.requestor_email
    });
    setShowCardholderLookup(false);
  };

  const handleBuildingToggle = (building) => {
    setFormData({
      ...formData,
      buildings: formData.buildings.includes(building)
        ? formData.buildings.filter(b => b !== building)
        : [...formData.buildings, building]
    });
  };

  if (!approval) return null;

  const startDate = approval.event_starts_at ? parseISO(approval.event_starts_at) : null;
  const endDate = approval.event_ends_at ? parseISO(approval.event_ends_at) : null;

  const isBadgeCodeValid = formData.badge_code && formData.badge_code.length === 6;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Approve Building Access Request
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Event Info Card */}
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-6 space-y-2">
                <div className="flex items-center gap-2 text-slate-700">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span className="font-medium">{approval.event_name}</span>
                </div>
                {startDate && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span>
                      {format(startDate, 'EEEE, MMMM d, yyyy')} at {format(startDate, 'h:mm a')}
                      {endDate && ` - ${format(endDate, 'h:mm a')}`}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span>{approval.resource_name}</span>
                </div>
              </CardContent>
            </Card>

            {/* Access Type */}
            <div className="space-y-2">
              <Label>Access Type *</Label>
              <RadioGroup value={formData.access_type} onValueChange={(value) => setFormData({...formData, access_type: value})}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="door_code" id="door_code" />
                  <Label htmlFor="door_code" className="font-normal cursor-pointer">Door Code (Badge)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="staff_unlock" id="staff_unlock" />
                  <Label htmlFor="staff_unlock" className="font-normal cursor-pointer">Staff Will Unlock</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Entrance */}
            <div className="space-y-2">
              <Label>Entrance *</Label>
              <RadioGroup value={formData.entrance} onValueChange={(value) => setFormData({...formData, entrance: value})}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="South Entrance" id="south" />
                  <Label htmlFor="south" className="font-normal cursor-pointer">South Entrance</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="North Entrance" id="north" />
                  <Label htmlFor="north" className="font-normal cursor-pointer">North Entrance</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="East Entrance" id="east" />
                  <Label htmlFor="east" className="font-normal cursor-pointer">East Entrance</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Badge/Door Code */}
            {formData.access_type === 'door_code' && (
              <div className="space-y-2">
                <Label htmlFor="badge_code">Door Code (6 digits) *</Label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input
                      id="badge_code"
                      value={formData.badge_code}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^\d]/g, '').slice(0, 6);
                        setFormData({...formData, badge_code: value});
                      }}
                      placeholder="123456"
                      maxLength={6}
                      className="font-mono text-lg pr-8"
                    />
                    {formData.badge_code && formData.badge_code.length === 6 && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-lg">#</span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCardholderLookup(true)}
                  >
                    <Search className="w-4 h-4 mr-2" />
                    Lookup
                  </Button>
                </div>
                {formData.badge_code && formData.badge_code.length < 6 && (
                  <p className="text-xs text-red-600">Code must be 6 digits</p>
                )}
                {isBadgeCodeValid && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Valid code format: {formData.badge_code}#
                  </p>
                )}
              </div>
            )}

            {/* Access Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_time">Access Start Time</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time">Access End Time</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                />
              </div>
            </div>

            {/* Buildings */}
            <div className="space-y-2">
              <Label>Buildings to Access</Label>
              <div className="space-y-2">
                {['main_building', 'worship_center', 'education_building', 'family_life_center'].map((building) => (
                  <div key={building} className="flex items-center space-x-2">
                    <Checkbox
                      id={building}
                      checked={formData.buildings.includes(building)}
                      onCheckedChange={() => handleBuildingToggle(building)}
                    />
                    <Label htmlFor={building} className="font-normal cursor-pointer">
                      {building.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Specific Doors */}
            <div className="space-y-2">
              <Label htmlFor="doors">Specific Doors/Rooms</Label>
              <Input
                id="doors"
                value={formData.doors}
                onChange={(e) => setFormData({...formData, doors: e.target.value})}
                placeholder="e.g., Room 201, Kitchen, Main Sanctuary"
              />
            </div>

            {/* Schedule Dropdown */}
            <div className="space-y-2">
              <Label htmlFor="schedule">Event Schedule</Label>
              <Select value={formData.schedule} onValueChange={(value) => setFormData({...formData, schedule: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select schedule..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sunday_morning">Sunday Morning</SelectItem>
                  <SelectItem value="sunday_evening">Sunday Evening</SelectItem>
                  <SelectItem value="wednesday">Wednesday</SelectItem>
                  <SelectItem value="weekday">Weekday</SelectItem>
                  <SelectItem value="special_event">Special Event</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Personnel */}
            <div className="space-y-2">
              <Label htmlFor="personnel">Staff/Personnel Involved</Label>
              <Input
                id="personnel"
                value={formData.personnel}
                onChange={(e) => setFormData({...formData, personnel: e.target.value})}
                placeholder="Names of staff who will be present"
              />
            </div>

            {/* Requestor Email */}
            <div className="space-y-2">
              <Label htmlFor="requestor_email">Requestor Email</Label>
              <Input
                id="requestor_email"
                type="email"
                value={formData.requestor_email}
                onChange={(e) => setFormData({...formData, requestor_email: e.target.value})}
                placeholder="email@fbca.org"
              />
            </div>

            {/* Additional Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Any special instructions or notes..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || (formData.access_type === 'door_code' && !isBadgeCodeValid)}
                className="bg-green-600 hover:bg-green-700"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Approving...
                  </>
                ) : (
                  'Approve & Create Task'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CardholderLookup
        open={showCardholderLookup}
        onOpenChange={setShowCardholderLookup}
        onSelect={handleCardholderSelect}
      />
    </>
  );
}
