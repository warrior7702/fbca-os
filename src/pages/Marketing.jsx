import React, { useState } from "react";
import AppHeader from "@/components/shared/AppHeader";
import { Megaphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin } from "lucide-react";

// Sample data - replace with actual PCO resources
const allResources = [
  { id: 1, name: "FBC 111 - Chapel Hall", type: "Room" },
  { id: 2, name: "FBC 112 - Chapel Hall", type: "Room" },
  { id: 3, name: "FBC 113 - Chapel Hall", type: "Room" },
  { id: 4, name: "FBC 115 - Chapel Hall", type: "Room" },
  { id: 5, name: "FBC 116 - Warming Kitchen", type: "Room" },
  { id: 6, name: "FBC 117 - Chapel Hall", type: "Room" },
  { id: 7, name: "FBC 120 - Chapel", type: "Room" },
  { id: 8, name: "FBC 121 - Chapel Hall", type: "Room" },
  { id: 9, name: "FBC 123 - Resource Library", type: "Room" },
  { id: 10, name: "FBC 124 - Hamill Welcome Center", type: "Room" },
  { id: 11, name: "FBC 128 - Cafe", type: "Room" },
  { id: 12, name: "FBC 137 - Huff Wing", type: "Room" },
  // Add remaining 88 resources as needed
];

export default function Marketing() {
  const [showAllResources, setShowAllResources] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const displayedResources = allResources.slice(0, 12);
  const remainingCount = allResources.length - displayedResources.length;

  const filteredResources = allResources.filter(resource =>
    resource.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full bg-gradient-to-br from-purple-50 to-pink-50 p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <AppHeader
          icon={Megaphone}
          title="Marketing"
          description="Marketing tools and resources"
          iconColor="from-purple-500 to-pink-500"
        />

        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                All Resources ({allResources.length})
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayedResources.map((resource) => (
                <div
                  key={resource.id}
                  className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <p className="font-medium text-slate-900">{resource.name}</p>
                  <Badge variant="secondary" className="mt-1 text-xs">
                    {resource.type}
                  </Badge>
                </div>
              ))}
            </div>

            {remainingCount > 0 && (
              <button
                onClick={() => setShowAllResources(true)}
                className="mt-4 text-purple-600 hover:text-purple-700 font-medium text-sm hover:underline"
              >
                + {remainingCount} more
              </button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* All Resources Modal */}
      <Dialog open={showAllResources} onOpenChange={setShowAllResources}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              All Resources ({allResources.length})
            </DialogTitle>
          </DialogHeader>

          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search resources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="overflow-y-auto flex-1 pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredResources.map((resource) => (
                <div
                  key={resource.id}
                  className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <p className="font-medium text-slate-900">{resource.name}</p>
                  <Badge variant="secondary" className="mt-1 text-xs">
                    {resource.type}
                  </Badge>
                </div>
              ))}
            </div>

            {filteredResources.length === 0 && (
              <div className="text-center py-12">
                <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No resources found</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}