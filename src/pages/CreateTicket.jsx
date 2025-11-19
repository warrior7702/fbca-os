import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Ticket as TicketIcon,
  Paperclip,
  X,
  Sparkles,
  CheckCircle,
  ArrowLeft,
  Loader2,
  MapPin
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function CreateTicket() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ticketNumber, setTicketNumber] = useState("");
  
  const [buildings, setBuildings] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [levels, setLevels] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loadingBuildings, setLoadingBuildings] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);

  const [ticket, setTicket] = useState({
    requester_name: "",
    requester_email: "",
    building: "",
    building_name: "",
    room_number: "",
    subject: "",
    details: "",
    priority: "medium",
    category: "",
    attachments: []
  });

  useEffect(() => {
    loadBuildings();
    loadCurrentUser();
    loadURLParams();
  }, []);

  const loadURLParams = () => {
    const params = new URLSearchParams(window.location.search);
    const buildingId = params.get('building_id');
    const buildingName = params.get('building_name');
    const level = params.get('level');
    const room = params.get('room');
    const asset = params.get('asset');
    
    if (buildingName) {
      setTicket(prev => ({
        ...prev,
        building: buildingName,
        room_number: room || level || ''
      }));
    }
    
    if (asset) {
      setTicket(prev => ({
        ...prev,
        subject: `Asset Issue: ${asset}`,
        description: `Issue with asset: ${asset}${room ? ` in ${room}` : ''}${level ? ` (${level})` : ''}`
      }));
    }
  };

  const loadCurrentUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      if (currentUser) {
        // Format name properly: "First Last" instead of "first.last"
        let displayName = currentUser.full_name || currentUser.email?.split('@')[0] || '';
        
        // If name has dots or is lowercase, format it
        if (displayName.includes('.') || displayName === displayName.toLowerCase()) {
          displayName = displayName.split('.').map(part => 
            part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
          ).join(' ');
        }
        
        setTicket(prev => ({
          ...prev,
          requester_name: displayName,
          requester_email: currentUser.email || ''
        }));
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  useEffect(() => {
    if (selectedBuilding && selectedLevel) {
      loadRooms();
    }
  }, [selectedBuilding, selectedLevel]);

  const loadBuildings = async () => {
    setLoadingBuildings(true);
    try {
      const response = await base44.functions.invoke('getAkitaBoxData', {
        type: 'buildings'
      });
      
      if (response.data.success) {
        setBuildings(response.data.data.buildings);
      }
    } catch (error) {
      console.error('Error loading buildings:', error);
      toast.error('Failed to load buildings');
    } finally {
      setLoadingBuildings(false);
    }
  };

  const handleBuildingChange = async (buildingId) => {
    const building = buildings.find(b => b.id === buildingId);
    setSelectedBuilding(building);
    setLevels(building?.levels || []);
    setSelectedLevel(null);
    setRooms([]);
    setTicket({
      ...ticket,
      building: buildingId,
      building_name: building?.name || '',
      room_number: ''
    });
  };

  const loadRooms = async () => {
    if (!selectedBuilding || !selectedLevel) return;
    
    setLoadingRooms(true);
    try {
      const response = await base44.functions.invoke('getAkitaBoxData', {
        type: 'rooms',
        buildingId: selectedBuilding.id,
        levelId: selectedLevel
      });
      
      if (response.data.success) {
        const roomsData = response.data.data.rooms || response.data.data || [];
        setRooms(Array.isArray(roomsData) ? roomsData : []);
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
      setRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  };

  const availableCategories = [
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'technology', label: 'Technology' },
    { value: 'cleaning', label: 'Cleaning' }
  ];

  const generateTicketNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    return `TKT-${timestamp}`;
  };

  const findSimilarTickets = async (description) => {
    setLoadingSuggestions(true);
    try {
      const prompt = `Analyze this support ticket description and find patterns:
"${description}"

Based on historical FBCA support tickets, suggest:
1. Similar past issues
2. Common solutions
3. Relevant documentation or resources

Keep response concise and actionable.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        add_context_from_internet: false
      });

      return response;
    } catch (error) {
      console.error("Error finding similar tickets:", error);
      return null;
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    try {
      const uploadPromises = files.map(async (file) => {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        return {
          name: file.name,
          url: file_url,
          uploaded_at: new Date().toISOString()
        };
      });

      const uploadedFiles = await Promise.all(uploadPromises);
      setTicket({
        ...ticket,
        attachments: [...ticket.attachments, ...uploadedFiles]
      });
      toast.success(`${files.length} file(s) uploaded`);
    } catch (error) {
      console.error("Error uploading files:", error);
      toast.error("Failed to upload files");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!ticket.requester_name || !ticket.requester_email || !ticket.subject || !ticket.category || !ticket.building) {
      toast.error("Please fill in all required fields");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(ticket.requester_email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setSubmitting(true);

    try {
      const newTicketNumber = generateTicketNumber();
      
      const ticketData = {
        ticket_number: newTicketNumber,
        requester_email: ticket.requester_email,
        requester_name: ticket.requester_name,
        subject: ticket.subject,
        description: `${ticket.subject}\n\n${ticket.details ? 'Additional Details: ' + ticket.details : ''}`.trim(),
        building: ticket.building_name || ticket.building,
        room_number: ticket.room_number,
        status: "open",
        priority: ticket.priority,
        category: ticket.category,
        source: "web_form",
        attachments: ticket.attachments,
        last_activity_at: new Date().toISOString()
      };

      const suggestion = await findSimilarTickets(ticket.subject);
      if (suggestion) {
        ticketData.suggested_solution = suggestion;
      }

      await base44.entities.Ticket.create(ticketData);
      
      setTicketNumber(newTicketNumber);
      setSubmitted(true);
      toast.success("Ticket submitted successfully!");
    } catch (error) {
      console.error("Error creating ticket:", error);
      toast.error("Failed to submit ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setTicketNumber("");
    setSelectedBuilding(null);
    setSelectedLevel(null);
    setLevels([]);
    setRooms([]);
    setTicket({
      requester_name: "",
      requester_email: "",
      building: "",
      building_name: "",
      room_number: "",
      subject: "",
      details: "",
      priority: "medium",
      category: "",
      attachments: []
    });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-50 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <Card className="text-center">
            <CardContent className="pt-12 pb-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <CheckCircle className="w-10 h-10 text-green-600" />
              </motion.div>
              
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Request Submitted!
              </h2>
              
              <p className="text-slate-600 mb-4">
                Your service request has been received and assigned ticket number:
              </p>
              
              <div className="inline-block bg-blue-50 border-2 border-blue-200 rounded-lg px-6 py-3 mb-6">
                <p className="text-2xl font-mono font-bold text-blue-600">
                  {ticketNumber}
                </p>
              </div>
              
              <p className="text-sm text-slate-500 mb-8">
                Our team will review your request and respond shortly.
                You'll receive updates at <span className="font-medium text-slate-700">{ticket.requester_email}</span>
              </p>
              
              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleReset}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  Submit Another Request
                </Button>
                <Button
                  onClick={() => navigate(createPageUrl('Dashboard'))}
                  variant="outline"
                  className="w-full"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-block p-4 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl shadow-lg mb-4">
            <TicketIcon className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            FBCA Service Request
          </h1>
          <p className="text-slate-600 text-lg">
            Fill out the form below to submit a service request
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                Request Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Name<span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={ticket.requester_name}
                      onChange={(e) => setTicket({...ticket, requester_name: e.target.value})}
                      placeholder="Your full name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Email Address<span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="email"
                      value={ticket.requester_email}
                      onChange={(e) => setTicket({...ticket, requester_email: e.target.value})}
                      placeholder="your.email@fbca.org"
                      required
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Building<span className="text-red-500">*</span>
                    </label>
                    <Select 
                      value={ticket.building || "wade_pcb"} 
                      onValueChange={(value) => setTicket({...ticket, building: value, building_name: "WADE PCB SC FBC"})}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select building..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wade_pcb">WADE PCB SC FBC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Floor/Level</label>
                    <Select 
                      value={selectedLevel} 
                      onValueChange={setSelectedLevel}
                      disabled={!selectedBuilding || levels.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select floor..." />
                      </SelectTrigger>
                      <SelectContent>
                        {levels.map(level => (
                          <SelectItem key={level._id} value={level._id}>
                            {level.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Room</label>
                    {loadingRooms ? (
                      <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-slate-50">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm text-slate-500">Loading rooms...</span>
                      </div>
                    ) : rooms.length > 0 ? (
                      <Select 
                        value={ticket.room_number} 
                        onValueChange={(value) => setTicket({...ticket, room_number: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select room..." />
                        </SelectTrigger>
                        <SelectContent>
                          {rooms.map(room => (
                            <SelectItem key={room._id} value={room.name || room.number || room._id}>
                              {room.name || room.number || 'Unnamed Room'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={ticket.room_number}
                        onChange={(e) => setTicket({...ticket, room_number: e.target.value})}
                        placeholder="Room number or name"
                        disabled={!selectedBuilding}
                      />
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Category<span className="text-red-500">*</span>
                    </label>
                    <Select 
                      value={ticket.category} 
                      onValueChange={(value) => setTicket({...ticket, category: value})}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCategories.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Brief Description<span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={ticket.subject}
                      onChange={(e) => setTicket({...ticket, subject: e.target.value})}
                      placeholder="Describe your issue"
                      required
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Additional Details</label>
                    <Textarea
                      value={ticket.details}
                      onChange={(e) => setTicket({...ticket, details: e.target.value})}
                      placeholder="Provide more details if needed"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Priority</label>
                    <Select 
                      value={ticket.priority} 
                      onValueChange={(value) => setTicket({...ticket, priority: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Attachments</label>
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center bg-slate-50 hover:bg-slate-100 transition-colors">
                    <input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      id="file-upload"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <Paperclip className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-slate-600">Drop your files here to upload</p>
                      <p className="text-xs text-slate-500 mt-1">or click to browse</p>
                    </label>
                  </div>
                  {ticket.attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {ticket.attachments.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-slate-700 bg-slate-100 p-2 rounded">
                          <Paperclip className="w-4 h-4" />
                          <span className="flex-1">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => setTicket({
                              ...ticket,
                              attachments: ticket.attachments.filter((_, i) => i !== idx)
                            })}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {loadingSuggestions && (
                  <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    Finding similar tickets and solutions...
                  </div>
                )}

                <div className="pt-4">
                  <Button 
                    type="submit" 
                    disabled={submitting || loadingSuggestions}
                    className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg"
                  >
                    {submitting ? "Submitting..." : "Submit Request"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center mt-8"
        >
          <p className="text-sm text-slate-500">
            Need immediate assistance? Contact us at{" "}
            <a href="mailto:support@fbca.org" className="text-blue-600 hover:underline">
              support@fbca.org
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
}