
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, Phone, Mail, Search as SearchIcon, Building2, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useLocation } from "react-router-dom";

export default function StaffDirectory() {
  const location = useLocation();
  const [staff, setStaff] = useState([]);
  const [filteredStaff, setFilteredStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMinistry, setSelectedMinistry] = useState("all");
  const [ministries, setMinistries] = useState([]);

  useEffect(() => {
    loadStaff();
    
    // Check for name parameter in URL
    const params = new URLSearchParams(location.search);
    const nameParam = params.get('name');
    if (nameParam) {
      setSearchQuery(nameParam);
    }
  }, [location.search]);

  useEffect(() => {
    filterStaff();
  }, [searchQuery, selectedMinistry, staff]);

  const loadStaff = async () => {
    try {
      const staffList = await base44.entities.StaffContact.list('last_name');
      setStaff(staffList);
      
      // Extract unique ministries
      const uniqueMinistries = [...new Set(staffList.map(s => s.ministry).filter(Boolean))].sort();
      setMinistries(uniqueMinistries);
    } catch (error) {
      console.error("Error loading staff:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterStaff = () => {
    let filtered = staff;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(person =>
        person.full_name.toLowerCase().includes(query) ||
        person.email.toLowerCase().includes(query) ||
        person.title?.toLowerCase().includes(query)
      );
    }

    // Filter by ministry
    if (selectedMinistry && selectedMinistry !== "all") {
      filtered = filtered.filter(person => person.ministry === selectedMinistry);
    }

    setFilteredStaff(filtered);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading staff directory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 h-full overflow-auto">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-blue-100 rounded-xl">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Staff Directory</h1>
            <p className="text-slate-600">{staff.length} team members</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by name, email, or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedMinistry} onValueChange={setSelectedMinistry}>
            <SelectTrigger className="w-full md:w-64">
              <SelectValue placeholder="All Ministries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ministries</SelectItem>
              {ministries.map(ministry => (
                <SelectItem key={ministry} value={ministry}>{ministry}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Staff Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStaff.map((person, index) => (
            <motion.div
              key={person.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="hover:shadow-lg transition-all h-full">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-semibold text-lg">
                        {person.first_name[0]}{person.last_name[0]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 text-lg">
                        {person.full_name}
                      </h3>
                      {person.title && (
                        <p className="text-sm text-slate-600 mt-1">{person.title}</p>
                      )}
                      {person.ministry && (
                        <Badge variant="secondary" className="mt-2">
                          <Building2 className="w-3 h-3 mr-1" />
                          {person.ministry}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {person.email && (
                      <>
                        <a
                          href={`mailto:${person.email}`}
                          className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                        >
                          <Mail className="w-4 h-4" />
                          {person.email}
                        </a>
                        <a
                          href={`msteams:/l/chat/0/0?users=${person.email}`}
                          className="flex items-center gap-2 text-sm text-purple-600 hover:underline"
                        >
                          <MessageSquare className="w-4 h-4" />
                          Message in Teams
                        </a>
                      </>
                    )}
                    {person.phone && (
                      <a
                        href={`tel:${person.phone}`}
                        className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600"
                      >
                        <Phone className="w-4 h-4" />
                        {person.phone}
                        {person.extension && ` (ext. ${person.extension})`}
                      </a>
                    )}
                    {person.cell_phone && (
                      <a
                        href={`tel:${person.cell_phone}`}
                        className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600"
                      >
                        <Phone className="w-4 h-4" />
                        {person.cell_phone} <span className="text-xs text-slate-400">(cell)</span>
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {filteredStaff.length === 0 && (
          <div className="text-center py-20">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No staff members found</p>
            <p className="text-sm text-slate-400 mt-2">Try adjusting your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
