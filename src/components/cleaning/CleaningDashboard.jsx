import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import CleaningWarningBanner from "@/components/cleaning/CleaningWarningBanner";
import { Building2, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

export default function CleaningDashboard() {
  const [buildings, setBuildings] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [filteredWarnings, setFilteredWarnings] = useState([]);
  const [selectedTemperature, setSelectedTemperature] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load buildings on mount
  useEffect(() => {
    loadBuildings();
  }, []);

  // Load warnings when building changes
  useEffect(() => {
    if (selectedBuilding) {
      loadWarnings();
    }
  }, [selectedBuilding]);

  // Filter warnings by temperature
  useEffect(() => {
    if (selectedTemperature === "all") {
      setFilteredWarnings(warnings);
    } else {
      setFilteredWarnings(warnings.filter(w => w.temperature === selectedTemperature));
    }
  }, [warnings, selectedTemperature]);

  const loadBuildings = async () => {
    try {
      const buildingsData = await base44.entities.Building.list();
      setBuildings(buildingsData);
      if (buildingsData.length > 0) {
        setSelectedBuilding(buildingsData[0].id);
      }
    } catch (error) {
      console.error("Error loading buildings:", error);
    }
  };

  const loadWarnings = async () => {
    setLoading(true);
    try {
      const result = await base44.functions.invoke('getRoomWarnings', {
        building_id: selectedBuilding
      });

      if (result.data && result.data.warnings) {
        setWarnings(result.data.warnings);
      } else {
        setWarnings([]);
      }
    } catch (error) {
      console.error("Error loading warnings:", error);
      setWarnings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadWarnings();
    setRefreshing(false);
  };

  const getTemperatureColor = (temp) => {
    switch (temp) {
      case 'HOT': return 'text-red-600 bg-red-50';
      case 'WARM': return 'text-orange-600 bg-orange-50';
      case 'COOL': return 'text-green-600 bg-green-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  const alertCount = warnings.filter(w => w.temperature === 'ALERT').length;
  const noticeCount = warnings.filter(w => w.temperature === 'NOTICE').length;

  if (loading && warnings.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header and Filters */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Building Selector */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Building
            </label>
            <Select value={selectedBuilding || ""} onValueChange={setSelectedBuilding}>
              <SelectTrigger>
                <SelectValue placeholder="Select building..." />
              </SelectTrigger>
              <SelectContent>
                {buildings.map((building) => (
                  <SelectItem key={building.id} value={building.id}>
                    {building.name || building.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Temperature Filter */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Priority Filter
            </label>
            <Select value={selectedTemperature} onValueChange={setSelectedTemperature}>
              <SelectTrigger>
                <SelectValue placeholder="All priorities..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="ALERT">🔴 Urgent (&lt;6hrs)</SelectItem>
                <SelectItem value="NOTICE">🟡 Upcoming (6-24hrs)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Refresh Button */}
          <div className="flex items-end">
            <Button 
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-full"
              variant="outline"
            >
              {refreshing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Refreshing...
                </>
              ) : (
                'Refresh'
              )}
            </Button>
          </div>
        </div>

        {/* Statistics */}
        {selectedBuilding && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Urgent (&lt;6hrs)</p>
                    <p className="text-2xl font-bold text-red-600">{alertCount}</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Upcoming (6-24hrs)</p>
                    <p className="text-2xl font-bold text-yellow-600">{noticeCount}</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">Total Rooms</p>
                    <p className="text-2xl font-bold text-slate-900">{warnings.length}</p>
                  </div>
                  <Building2 className="w-8 h-8 text-slate-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Warnings List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Room Cleaning Status</span>
            {filteredWarnings.length === 0 && warnings.length > 0 && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                All Clear
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredWarnings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
              <p className="text-slate-600 font-medium">
                {warnings.length === 0 ? 'No rooms loaded' : 'No rooms matching filter'}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {warnings.length === 0 ? 'Select a building to view cleaning status' : 'Try adjusting your filters'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredWarnings.map((warning, index) => (
                <CleaningWarningBanner
                  key={index}
                  room={warning.room}
                  warning={warning}
                  onRefresh={handleRefresh}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}