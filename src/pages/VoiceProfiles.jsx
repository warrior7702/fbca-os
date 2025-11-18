import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Search, Loader2, Mic, Trash2 } from "lucide-react";
import AppHeader from "../components/shared/AppHeader";
import VoiceProfileRecorder from "../components/meetings/VoiceProfileRecorder";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

export default function VoiceProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [staffResults, setStaffResults] = useState([]);
  const [searchingStaff, setSearchingStaff] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);

  useEffect(() => {
    loadProfiles();
    loadAllStaff();
  }, []);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.VoiceProfile.list();
      setProfiles(data);
    } catch (error) {
      console.error('Error loading profiles:', error);
      toast.error('Failed to load voice profiles');
    } finally {
      setLoading(false);
    }
  };

  const loadAllStaff = async () => {
    setSearchingStaff(true);
    try {
      const response = await base44.functions.invoke('getMicrosoftUsers', {});
      if (response.data.success && response.data.users) {
        setStaffResults(response.data.users);
      }
    } catch (error) {
      console.error('Error loading staff:', error);
    } finally {
      setSearchingStaff(false);
    }
  };

  const handleSearchStaff = async (query) => {
    if (!query || query.length < 2) {
      loadAllStaff();
      return;
    }

    setSearchingStaff(true);
    try {
      const response = await base44.functions.invoke('getMicrosoftUsers', {
        searchQuery: query
      });
      if (response.data.success && response.data.users) {
        setStaffResults(response.data.users);
      }
    } catch (error) {
      console.error('Error searching staff:', error);
    } finally {
      setSearchingStaff(false);
    }
  };

  const handleDeleteProfile = async (profileId) => {
    if (!confirm('Delete this voice profile?')) return;

    try {
      await base44.entities.VoiceProfile.delete(profileId);
      await loadProfiles();
      toast.success('Voice profile deleted');
    } catch (error) {
      console.error('Error deleting profile:', error);
      toast.error('Failed to delete profile');
    }
  };

  const filteredStaff = staffResults.filter(person => {
    const hasProfile = profiles.some(p => p.person_email === (person.mail || person.userPrincipalName));
    return !hasProfile;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-purple-50 to-pink-50 overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <AppHeader
          icon={Users}
          title="Voice Profiles"
          description={`${profiles.length} voice profiles for AI speaker identification`}
          iconColor="from-purple-500 to-pink-500"
        />

        {/* Info Card */}
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-700">
              Record voice samples for team members to enable automatic speaker identification in meeting transcripts. 
              Record 2-3 short samples (5-10 seconds each) per person for best results.
            </p>
          </CardContent>
        </Card>

        {/* Existing Profiles */}
        {profiles.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-4">Enrolled ({profiles.length})</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {profiles.map((profile) => (
                <Card key={profile.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="text-base">{profile.person_name}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteProfile(profile.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm text-slate-600">
                      <p>{profile.person_email}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          <Mic className="w-3 h-3 mr-1" />
                          {profile.voice_samples?.length || 0} samples
                        </Badge>
                        {profile.times_identified > 0 && (
                          <Badge variant="secondary">
                            ID'd {profile.times_identified}x
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Add New Profile */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Add New Voice Profile</h2>
          
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Search staff to add..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                handleSearchStaff(e.target.value);
              }}
              className="pl-11"
            />
          </div>

          {searchingStaff ? (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600 mx-auto" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredStaff.slice(0, 12).map((person) => (
                <Card key={person.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{person.displayName}</p>
                        <p className="text-xs text-slate-500">{person.mail || person.userPrincipalName}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedPerson({
                            name: person.displayName,
                            email: person.mail || person.userPrincipalName
                          });
                          setShowRecorder(true);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Recorder Modal */}
        <Dialog open={showRecorder} onOpenChange={setShowRecorder}>
          <DialogContent className="max-w-2xl">
            {selectedPerson && (
              <VoiceProfileRecorder
                person={selectedPerson}
                onSaved={() => {
                  setShowRecorder(false);
                  setSelectedPerson(null);
                  loadProfiles();
                }}
                onCancel={() => {
                  setShowRecorder(false);
                  setSelectedPerson(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}