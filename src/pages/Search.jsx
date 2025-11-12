
import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ConnectionWarning from "../components/shared/ConnectionWarning";
import {
  Search as SearchIcon,
  FileText,
  Folder,
  ArrowLeft,
  Loader2,
  Megaphone,
  UtensilsCrossed,
  User,
  LayoutDashboard,
  ExternalLink,
  Download,
  FileImage,
  FileVideo,
  FileArchive,
  Users,
  Mail,
  Phone,
  MessageSquare,
  CheckSquare,
  Settings,
  Video, // Added for My Meetings
  ClipboardCheck, // Added for Approvals
  Calendar as CalendarIcon, // Renamed to avoid conflict with standard Calendar component
  Building2, // Added for My Department
  Ticket // Added for Support Requests
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const appModules = [
  { name: "Dashboard", path: "Dashboard", icon: LayoutDashboard, description: "Your main hub", color: "text-blue-500" },
  { name: "Tasks", path: "MyTasks", icon: CheckSquare, description: "ClickUp tasks, calendar, and emails", color: "text-indigo-500" },
  { name: "My Meetings", path: "MyMeetings", icon: Video, description: "Calendar meetings and schedule", color: "text-purple-500" },
  { name: "Approvals", path: "MyApprovals", icon: ClipboardCheck, description: "Pending approval requests", color: "text-orange-500" },
  { name: "Church Calendar", path: "Calendar", icon: CalendarIcon, description: "Church-wide calendar view", color: "text-blue-600" },
  { name: "Communications Requests", path: "WorkflowHub", icon: MessageSquare, description: "Communications workflow and requests", color: "text-purple-500" },
  { name: "Hospitality", path: "FoodService", icon: UtensilsCrossed, description: "Catering orders and menu planning", color: "text-green-500" },
  { name: "Directory", path: "StaffDirectory", icon: Users, description: "Contact information for all FBCA staff", color: "text-teal-500" },
  { name: "My Department", path: "MyDepartment", icon: Building2, description: "Department-specific view", color: "text-violet-500" },
  { name: "Documents", path: "Documents", icon: Folder, description: "Browse OneDrive files", color: "text-blue-500" },
  { name: "Support Requests", path: "Ticketing", icon: Ticket, description: "Submit and track support tickets", color: "text-amber-500" },
  { name: "Settings", path: "Settings", icon: Settings, description: "Manage preferences and integrations", color: "text-slate-500" }
];

export default function Search() {
  const navigate = useNavigate();
  const location = useLocation();
  // Changed: Replaced useUser hook with useState and useEffect for user data
  const [user, setUser] = useState(null);
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState([]);
  const [modules, setModules] = useState([]);
  const [people, setPeople] = useState([]);
  const [localStaff, setLocalStaff] = useState([]);
  const [workflowRequests, setWorkflowRequests] = useState([]); // New state for workflow requests
  const [tickets, setTickets] = useState([]); // New state for support tickets
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Changed: Added useEffect to load user data from base44.auth.me()
  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    if (q) {
      setQuery(q);
      performSearch(q);
    }
  }, [location.search]);

  // Relevance calculation
  const calculateRelevance = (item, searchQuery) => {
    const lowerQuery = searchQuery.toLowerCase();
    const lowerName = item.name?.toLowerCase() || item.displayName?.toLowerCase() || item.full_name?.toLowerCase() || item.title?.toLowerCase() || item.subject?.toLowerCase() || '';
    
    if (lowerName === lowerQuery) return 1000;
    if (lowerName.startsWith(lowerQuery)) return 500;
    if (lowerName.includes(lowerQuery)) return 100;
    return 1;
  };

  const performSearch = async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 2) {
      setFiles([]);
      setModules([]);
      setPeople([]);
      setLocalStaff([]);
      setWorkflowRequests([]); // Clear workflow requests
      setTickets([]); // Clear tickets
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);

    // Search modules
    const matchedModules = appModules
      .filter(module =>
        module.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        module.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .map(module => ({
        ...module,
        relevance: calculateRelevance(module, searchQuery)
      }))
      .sort((a, b) => b.relevance - a.relevance);
    
    setModules(matchedModules);

    // Search files, people, local staff, workflow requests, and tickets
    try {
      const lowerQuery = searchQuery.toLowerCase();

      // Get local staff first
      const staffResponse = await base44.entities.StaffContact.filter({});
      //console.log('Total staff loaded:', staffResponse?.length || 0);

      // Filter local staff
      const matchedStaff = (staffResponse || [])
        .filter(person => {
          const fullNameMatch = person.full_name?.toLowerCase().includes(lowerQuery);
          const firstNameMatch = person.first_name?.toLowerCase().includes(lowerQuery);
          const lastNameMatch = person.last_name?.toLowerCase().includes(lowerQuery);
          const emailMatch = person.email?.toLowerCase().includes(lowerQuery);
          const titleMatch = person.title?.toLowerCase().includes(lowerQuery);
          const ministryMatch = person.ministry?.toLowerCase().includes(lowerQuery);
          const phoneMatch = person.phone?.includes(searchQuery);
          const cellMatch = person.cell_phone?.includes(searchQuery);
          
          return fullNameMatch || firstNameMatch || lastNameMatch || emailMatch || 
                 titleMatch || ministryMatch || phoneMatch || cellMatch;
        })
        .map(person => ({
          ...person,
          relevance: calculateRelevance(person, searchQuery)
        }))
        .sort((a, b) => b.relevance - a.relevance);
      
      //console.log('Matched staff:', matchedStaff.map(s => s.full_name));
      setLocalStaff(matchedStaff);

      // Search workflow requests
      const workflowResponse = await base44.entities.WorkflowRequest.filter({});
      const matchedWorkflows = (workflowResponse || [])
        .filter(req => {
          return req.title?.toLowerCase().includes(lowerQuery) ||
                 req.request_number?.toLowerCase().includes(lowerQuery) ||
                 req.description?.toLowerCase().includes(lowerQuery) ||
                 req.requestor_name?.toLowerCase().includes(lowerQuery);
        })
        .map(req => ({
          ...req,
          relevance: calculateRelevance(req, searchQuery)
        }))
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 10); // Limit to top 10 results for brevity
      
      setWorkflowRequests(matchedWorkflows);

      // Search support tickets
      const ticketsResponse = await base44.entities.Ticket.filter({});
      const matchedTickets = (ticketsResponse || [])
        .filter(ticket => {
          return ticket.subject?.toLowerCase().includes(lowerQuery) ||
                 ticket.ticket_number?.toLowerCase().includes(lowerQuery) ||
                 ticket.description?.toLowerCase().includes(lowerQuery) ||
                 ticket.requestor_name?.toLowerCase().includes(lowerQuery); // Assuming requestor_name exists on Ticket
        })
        .map(ticket => ({
          ...ticket,
          relevance: calculateRelevance(ticket, searchQuery)
        }))
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 10); // Limit to top 10 results for brevity
      
      setTickets(matchedTickets);

      // Search files and Microsoft people in parallel
      const [filesResponse, peopleResponse] = await Promise.all([
        base44.functions.invoke('searchOneDrive', { query: searchQuery }).catch(() => ({ data: { files: [] } })),
        base44.functions.invoke('searchStaff', { query: searchQuery }).catch(() => ({ data: { people: [] } }))
      ]);

      const sortedFiles = (filesResponse.data.files || [])
        .map(file => ({
          ...file,
          relevance: calculateRelevance(file, searchQuery)
        }))
        .sort((a, b) => b.relevance - a.relevance);

      setFiles(sortedFiles);
      setPeople(peopleResponse.data.people || []);

    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    navigate(createPageUrl('Search') + `?q=${encodeURIComponent(query)}`);
  };

  const getFileIcon = (name) => {
    const ext = name.split('.').pop().toLowerCase();
    if (ext.match(/jpg|jpeg|png|gif|svg|webp/)) return FileImage;
    if (ext.match(/mp4|mov|avi|mkv/)) return FileVideo;
    if (ext.match(/zip|rar|7z|tar|gz/)) return FileArchive;
    return FileText;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const totalResults = modules.length + files.length + people.length + localStaff.length + workflowRequests.length + tickets.length;

  return (
    <div className="h-full bg-gradient-to-br from-blue-50 to-slate-50 p-6 overflow-auto">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl('Dashboard'))}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Search</h1>
            <p className="text-slate-600 text-sm">Search across files, modules, staff, and more</p>
          </div>
        </div>

        {/* Connection Warning */}
        {(!user?.microsoft_access_token || !user?.clickup_access_token) && (
          <div className="mb-6">
            <ConnectionWarning />
          </div>
        )}

        <form onSubmit={handleSearch} className="mb-8">
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              type="text"
              placeholder="Search files, staff, work orders, tickets, and more..." // Updated placeholder
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-12 h-14 text-lg"
              autoFocus
            />
          </div>
        </form>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}

        {!loading && hasSearched && (
          <div className="space-y-6">
            {totalResults > 0 && (
              <div className="text-sm text-slate-600">
                Found {totalResults} result{totalResults !== 1 ? 's' : ''} for "{query}"
              </div>
            )}

            {/* Local Staff Directory */}
            {localStaff.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  FBCA Staff ({localStaff.length})
                </h2>
                <div className="grid md:grid-cols-2 gap-3">
                  {localStaff.map((person) => (
                    <motion.div
                      key={person.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => navigate(createPageUrl('StaffDirectory') + `?name=${encodeURIComponent(person.full_name)}`)}
                      className="cursor-pointer"
                    >
                      <Card className="hover:shadow-lg transition-all">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                              <span className="text-white font-semibold">
                                {person.first_name[0]}{person.last_name[0]}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-900">{person.full_name}</p>
                              {person.title && (
                                <p className="text-sm text-slate-600">{person.title}</p>
                              )}
                              {person.ministry && (
                                <Badge variant="secondary" className="mt-1 text-xs">
                                  {person.ministry}
                                </Badge>
                              )}
                              <div className="flex flex-col gap-1 mt-2">
                                {person.email && (
                                  <>
                                    <a 
                                      href={`mailto:${person.email}`}
                                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                      onClick={(e) => e.stopPropagation()} // Prevent card click from navigating
                                    >
                                      <Mail className="w-3 h-3" />
                                      {person.email}
                                    </a>
                                    <a 
                                      href={`msteams:/l/chat/0/0?users=${person.email}`}
                                      className="text-xs text-purple-600 hover:underline flex items-center gap-1"
                                      onClick={(e) => e.stopPropagation()} // Prevent card click from navigating
                                    >
                                      <MessageSquare className="w-3 h-3" />
                                      Message in Teams
                                    </a>
                                  </>
                                )}
                                {person.phone && (
                                  <a 
                                    href={`tel:${person.phone}`}
                                    className="text-xs text-slate-600 hover:text-blue-600 flex items-center gap-1"
                                    onClick={(e) => e.stopPropagation()} // Prevent card click from navigating
                                  >
                                    <Phone className="w-3 h-3" />
                                    {person.phone}
                                    {person.extension && ` (ext. ${person.extension})`}
                                  </a>
                                )}
                                {person.cell_phone && (
                                  <a 
                                    href={`tel:${person.cell_phone}`}
                                    className="text-xs text-slate-600 hover:text-blue-600 flex items-center gap-1"
                                    onClick={(e) => e.stopPropagation()} // Prevent card click from navigating
                                  >
                                    <Phone className="w-3 h-3" />
                                    {person.cell_phone} <span className="text-xs text-slate-400">(cell)</span>
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Microsoft 365 Directory */}
            {people.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Microsoft 365 Directory ({people.length})
                </h2>
                <div className="grid md:grid-cols-2 gap-3">
                  {people.map((person) => (
                    <motion.div
                      key={person.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <Card className="hover:shadow-lg transition-all">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {person.photoUrl ? (
                                <img src={person.photoUrl} alt={person.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-white font-semibold">
                                  {person.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-900">{person.name}</p>
                              {person.jobTitle && (
                                <p className="text-sm text-slate-600">{person.jobTitle}</p>
                              )}
                              {person.department && (
                                <p className="text-xs text-slate-500">{person.department}</p>
                              )}
                              <div className="flex flex-wrap gap-2 mt-2">
                                {person.email && (
                                  <a 
                                    href={`mailto:${person.email}`}
                                    className="text-xs text-blue-600 hover:underline"
                                  >
                                    {person.email}
                                  </a>
                                )}
                                {person.phone && (
                                  <a 
                                    href={`tel:${person.phone}`}
                                    className="text-xs text-blue-600 hover:underline"
                                  >
                                    {person.phone}
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Communications Requests */}
            {workflowRequests.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Communications Requests ({workflowRequests.length})
                </h2>
                <div className="space-y-2">
                  {workflowRequests.map((req) => (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => navigate(createPageUrl('WorkflowHub') + `?id=${req.id}`)} // Assuming a detail page for workflow requests
                      className="cursor-pointer"
                    >
                      <Card className="hover:shadow-lg transition-all">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-slate-900">{req.title}</p>
                              <p className="text-sm text-slate-600 mt-1">{req.request_number}</p>
                              <div className="flex gap-2 mt-2">
                                {req.status && <Badge variant="outline">{req.status}</Badge>}
                                {req.ministry_department && (
                                  <Badge variant="secondary">{req.ministry_department}</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Support Tickets */}
            {tickets.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Ticket className="w-5 h-5" />
                  Support Requests ({tickets.length})
                </h2>
                <div className="space-y-2">
                  {tickets.map((ticket) => (
                    <motion.div
                      key={ticket.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => navigate(createPageUrl('Ticketing') + `?id=${ticket.id}`)} // Assuming a detail page for tickets
                      className="cursor-pointer"
                    >
                      <Card className="hover:shadow-lg transition-all">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-slate-900">{ticket.subject}</p>
                              <p className="text-sm text-slate-600 mt-1">{ticket.ticket_number}</p>
                              <div className="flex gap-2 mt-2">
                                {ticket.status && <Badge variant="outline">{ticket.status}</Badge>}
                                {ticket.priority && (
                                  <Badge className={
                                    ticket.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                                    ticket.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                                    'bg-slate-100 text-slate-700'
                                  }>{ticket.priority}</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Modules */}
            {modules.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-3">Modules</h2>
                <div className="grid md:grid-cols-2 gap-3">
                  {modules.map((module) => (
                    <Link key={module.path} to={createPageUrl(module.path)}>
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ scale: 1.02 }}
                      >
                        <Card className="hover:shadow-lg transition-all cursor-pointer">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-slate-100 rounded-lg">
                                <module.icon className={`w-6 h-6 ${module.color}`} />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-slate-900">{module.name}</p>
                                <p className="text-sm text-slate-500">{module.description}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Files */}
            {files.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-3">Files & Folders</h2>
                <div className="space-y-2">
                  {files.map((file) => {
                    const Icon = file.isFolder ? Folder : getFileIcon(file.name);
                    return (
                      <motion.div
                        key={file.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <Card className="hover:shadow-md transition-all">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${file.isFolder ? 'bg-blue-100' : 'bg-slate-100'}`}>
                                <Icon className={`w-5 h-5 ${file.isFolder ? 'text-blue-600' : 'text-slate-600'}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-slate-900 truncate">{file.name}</p>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                  {file.isFolder && file.fileCount && (
                                    <span>{file.fileCount} matching file{file.fileCount !== 1 ? 's' : ''}</span>
                                  )}
                                  {!file.isFolder && <span>{formatFileSize(file.size)}</span>}
                                  {file.path && <span>• {file.path}</span>}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.open(file.webUrl, '_blank')}
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </Button>
                                {!file.isFolder && file.downloadUrl && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => window.open(file.downloadUrl, '_blank')}
                                  >
                                    <Download className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {totalResults === 0 && (
              <div className="text-center py-20">
                <SearchIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No results found for "{query}"</p>
                <p className="text-sm text-slate-400 mt-2">Try searching with different keywords</p>
              </div>
            )}
          </div>
        )}

        {!hasSearched && !loading && (
          <div className="text-center py-20">
            <SearchIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">Start typing to search</p>
            <p className="text-sm text-slate-400 mt-2">Search files, modules, staff, work orders, and support requests</p>
          </div>
        )}
      </div>
    </div>
  );
}
