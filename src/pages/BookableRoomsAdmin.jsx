import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RefreshCw, CheckCircle2, XCircle, Loader2, Search, MapPin } from "lucide-react";
import { toast } from "sonner";

export default function BookableRoomsAdmin() {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    setLoading(true);
    try {
      const allRooms = await base44.entities.Room.list();
      setRooms(allRooms);
    } catch (error) {
      console.error('Error loading rooms:', error);
      toast.error('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data } = await base44.functions.invoke('syncBookableRoomsFromPCO');
      setSyncResult(data);
      await loadRooms();
      toast.success('Sync completed!');
    } catch (error) {
      console.error('Error syncing:', error);
      toast.error('Sync failed: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  const filteredRooms = rooms.filter(room => {
    const query = searchQuery.toLowerCase();
    return (
      (room.room_name || '').toLowerCase().includes(query) ||
      (room.room_number || '').toLowerCase().includes(query) ||
      (room.pco_resource_id || '').toLowerCase().includes(query)
    );
  });

  const bookableRooms = filteredRooms.filter(r => r.is_bookable);
  const nonBookableRooms = filteredRooms.filter(r => !r.is_bookable);
  const mappedRooms = filteredRooms.filter(r => r.pco_resource_id);
  const unmappedRooms = filteredRooms.filter(r => !r.pco_resource_id);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Bookable Rooms Admin</h1>
            <p className="text-slate-600 mt-1">Manage PCO bookable room mappings</p>
          </div>
          <Button
            onClick={handleSync}
            disabled={syncing}
            className="bg-violet-600 hover:bg-violet-700"
          >
            {syncing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync from PCO
              </>
            )}
          </Button>
        </div>

        {/* Sync Results */}
        {syncResult && (
          <Card className="border-violet-200 bg-violet-50">
            <CardHeader>
              <CardTitle className="text-lg">Last Sync Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-sm text-slate-600">PCO Rooms</p>
                  <p className="text-2xl font-bold text-slate-900">{syncResult.stats?.pco_rooms_total || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Campus Hub</p>
                  <p className="text-2xl font-bold text-slate-900">{syncResult.stats?.campus_hub_rooms_total || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Matched</p>
                  <p className="text-2xl font-bold text-green-600">{syncResult.stats?.matched || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Unmatched</p>
                  <p className="text-2xl font-bold text-amber-600">{syncResult.stats?.unmatched || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Updated</p>
                  <p className="text-2xl font-bold text-blue-600">{syncResult.stats?.updated || 0}</p>
                </div>
              </div>

              {syncResult.unmatched_pco_rooms && syncResult.unmatched_pco_rooms.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-slate-700 mb-2">Unmatched PCO Rooms:</p>
                  <div className="flex flex-wrap gap-2">
                    {syncResult.unmatched_pco_rooms.map((room, idx) => (
                      <Badge key={idx} variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                        {room.pco_name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total Rooms</p>
                  <p className="text-2xl font-bold text-slate-900">{filteredRooms.length}</p>
                </div>
                <MapPin className="w-8 h-8 text-slate-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Bookable</p>
                  <p className="text-2xl font-bold text-green-600">{bookableRooms.length}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">PCO Mapped</p>
                  <p className="text-2xl font-bold text-blue-600">{mappedRooms.length}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Unmapped</p>
                  <p className="text-2xl font-bold text-amber-600">{unmappedRooms.length}</p>
                </div>
                <XCircle className="w-8 h-8 text-amber-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search rooms by name, number, or PCO ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Rooms List */}
        <Card>
          <CardHeader>
            <CardTitle>All Rooms</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
              </div>
            ) : filteredRooms.length === 0 ? (
              <p className="text-center text-slate-500 py-12">No rooms found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 text-sm font-semibold text-slate-700">Room</th>
                      <th className="text-left p-3 text-sm font-semibold text-slate-700">Building</th>
                      <th className="text-left p-3 text-sm font-semibold text-slate-700">PCO Resource ID</th>
                      <th className="text-left p-3 text-sm font-semibold text-slate-700">Bookable</th>
                      <th className="text-left p-3 text-sm font-semibold text-slate-700">Source</th>
                      <th className="text-left p-3 text-sm font-semibold text-slate-700">Last Sync</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRooms.map(room => (
                      <tr key={room.id} className="border-b hover:bg-slate-50">
                        <td className="p-3">
                          <div>
                            <p className="font-medium text-slate-900">{room.room_name || 'Unnamed'}</p>
                            <p className="text-xs text-slate-500">{room.room_number}</p>
                          </div>
                        </td>
                        <td className="p-3 text-sm text-slate-600">
                          {room.building_name || '-'}
                        </td>
                        <td className="p-3">
                          {room.pco_resource_id ? (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 font-mono text-xs">
                              {room.pco_resource_id}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-300 text-xs">
                              Not Mapped
                            </Badge>
                          )}
                        </td>
                        <td className="p-3">
                          {room.is_bookable ? (
                            <Badge className="bg-green-100 text-green-700 border-green-300">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Yes
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-100 text-slate-500">
                              <XCircle className="w-3 h-3 mr-1" />
                              No
                            </Badge>
                          )}
                        </td>
                        <td className="p-3">
                          {room.bookable_source ? (
                            <Badge variant="outline" className="text-xs">
                              {room.bookable_source}
                            </Badge>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-3 text-xs text-slate-500">
                          {room.last_pco_sync_at 
                            ? new Date(room.last_pco_sync_at).toLocaleString()
                            : '-'
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}