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
  MapPin,
  AlertCircle,
  ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  const [generatingTitle, setGeneratingTitle] = useState(false);
  const [issueDescription, setIssueDescription] = useState("");
  
  const [buildings, setBuildings] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [levels, setLevels] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [selectedAssetEntity, setSelectedAssetEntity] = useState(null);
  const [loadingBuildings, setLoadingBuildings] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [roomSearch, setRoomSearch] = useState("");
  const [showRoomDropdown, setShowRoomDropdown] = useState(false);
  const [buildingSearch, setBuildingSearch] = useState("");
  const [showBuildingDropdown, setShowBuildingDropdown] = useState(false);
  const [roomAssets, setRoomAssets] = useState([]);
  const [assetSearch, setAssetSearch] = useState("");
  const [showAssetDropdown, setShowAssetDropdown] = useState(false);
  const [contextLoaded, setContextLoaded] = useState(false);
  const [inferredContext, setInferredContext] = useState({
    type: null,
    display: null
  });
  const [urlAssetId, setUrlAssetId] = useState(null);

  const [ticket, setTicket] = useState({
    requester_name: "",
    requester_email: "",
    building: "",
    building_id: "",
    floor_id: "",
    room_id: "",
    room_number: "",
    subject: "",
    details: "",
    priority: "",
    category: "",
    asset_id: "",
    asset_name: "",
    attachments: []
  });
  const [suggestedCategory, setSuggestedCategory] = useState("");
  const [suggestedPriority, setSuggestedPriority] = useState("medium");
  const [priorityReason, setPriorityReason] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [duplicateTickets, setDuplicateTickets] = useState([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  useEffect(() => {
    loadCurrentUser();
    loadBuildingsFromDB();
    loadURLParams();
  }, []);

  // Map asset categories to ticket categories
  const mapAssetCategoryToTicketCategory = (assetCategory) => {
    if (!assetCategory) return null;
    
    const category = assetCategory.toLowerCase();
    
    // Technology-related keywords
    if (category.includes('av') || category.includes('audio') || category.includes('video') ||
        category.includes('computer') || category.includes('network') || category.includes('projector') ||
        category.includes('screen') || category.includes('technology') || category.includes('it') ||
        category.includes('camera') || category.includes('sound') || category.includes('lighting')) {
      return 'technology';
    }
    
    // Cleaning-related keywords
    if (category.includes('cleaning') || category.includes('janitorial')) {
      return 'cleaning';
    }
    
    // Default to maintenance for everything else (HVAC, plumbing, electrical, etc.)
    return 'maintenance';
  };

  // Determine assigned department and reason
  const determineAssignedDepartment = (category, scope, asset) => {
    let department = null;
    let reason = null;

    // Check if asset implies technology (for ASSET scope)
    if (scope === "ASSET" && asset) {
      const assetLower = (asset.name || '').toLowerCase();
      const assetCategory = (asset.category || '').toLowerCase();
      
      if (assetLower.includes('av') || assetLower.includes('audio') || assetLower.includes('video') ||
          assetLower.includes('computer') || assetLower.includes('network') || assetLower.includes('projector') ||
          assetLower.includes('screen') || assetLower.includes('camera') || assetLower.includes('printer') ||
          assetCategory.includes('av') || assetCategory.includes('network') || assetCategory.includes('technology')) {
        department = 'IT';
        reason = `From asset type: ${asset.name}`;
        return { department, reason };
      }
    }

    // Infer from category
    if (category === 'technology') {
      department = 'IT';
      reason = 'From category: technology';
    } else if (category === 'maintenance') {
      department = 'Facilities';
      reason = 'From category: maintenance';
    } else if (category === 'cleaning') {
      department = 'Facilities';
      reason = 'From category: cleaning';
    } else {
      // Default
      department = 'Facilities';
      reason = 'Defaulted to Facilities';
    }

    return { department, reason };
  };

  const loadURLParams = async () => {
    const params = new URLSearchParams(window.location.search);
    const buildingId = params.get('building_id');
    const roomId = params.get('room_id');
    const assetId = params.get('asset_id');
    const assetNameParam = params.get('asset_name');
    const assetCategoryParam = params.get('asset_category');

    let contextDisplay = null;
    let contextType = null;
    let currentTicketState = {};

    // Load buildings first
    const loadedBuildings = await base44.entities.Building.list();
    setBuildings(loadedBuildings);

    // If asset_id exists, immediately set it and mark as asset context
    if (assetId) {
      setUrlAssetId(assetId);
      currentTicketState.asset_id = assetId;
      contextType = 'asset';
    }

    // If asset_id exists but no building_id, fetch asset first to derive building/room/floor
    let derivedBuildingId = buildingId;
    let derivedRoomId = roomId;
    let asset = null;

    if (assetId && !buildingId) {
      try {
        const allAssets = await base44.entities.Asset.list();
        asset = allAssets.find(a => a.id === assetId);
        if (asset) {
          derivedBuildingId = asset.building_id;
          derivedRoomId = asset.room_id || derivedRoomId;
          setSelectedAssetEntity(asset);
          setAssetSearch(asset.name);
          currentTicketState = {
            ...currentTicketState,
            asset_id: asset.id,
            asset_name: asset.name,
            building_id: asset.building_id,
            room_id: asset.room_id,
            floor_id: asset.floor_id,
            subject: `Asset Issue: ${asset.name}`
          };
        }
      } catch (err) {
        console.error('Error loading asset by ID:', err);
      }
    }

    // Handle Building context
    if (derivedBuildingId) {
      const building = loadedBuildings.find(b => b.id === derivedBuildingId);
      if (building) {
        setSelectedBuilding(building);
        setBuildingSearch(building.name);

        // Load rooms for this building
        const roomsData = await base44.entities.Room.filter({ building_id: derivedBuildingId });
        const sortedRooms = roomsData.sort((a, b) => {
          const aNum = a.room_number || a.room_name || '';
          const bNum = b.room_number || b.room_name || '';
          return aNum.localeCompare(bNum, undefined, { numeric: true });
        });
        setRooms(sortedRooms);

        // Update building info in ticket state
        currentTicketState = {
          ...currentTicketState,
          building: building.name,
          building_id: derivedBuildingId
        };

        // Handle Room context
        if (derivedRoomId) {
          const room = roomsData.find(r => r.id === derivedRoomId);
          if (room) {
            const roomDisplay = room.room_number 
              ? `${room.room_number} - ${room.room_name || 'Unnamed'}` 
              : (room.room_name || room.room_number || 'Room');
            setRoomSearch(roomDisplay);

            currentTicketState = {
              ...currentTicketState,
              room_id: derivedRoomId,
              room_number: room.room_number || room.room_name || '',
              floor_id: room.floor_id || currentTicketState.floor_id
            };

            if (!assetId && !assetNameParam) {
              contextType = 'room';
              contextDisplay = {
                primary: room.room_name || room.room_number || 'Room',
                secondary: `${building.name}${room.floor_name ? ' • ' + room.floor_name : ''}`
              };
            }
          }
        } else if (!assetId && !assetNameParam) {
          // No room, just building
          contextType = 'building';
          contextDisplay = {
            primary: building.name,
            secondary: 'Building-wide issue'
          };
        }

        // Handle Asset context - fetch full asset entity if not already loaded
        if ((assetId || assetNameParam) && !asset) {
          if (assetNameParam) setAssetSearch(assetNameParam);

          if (!currentTicketState.asset_name) {
            currentTicketState = {
              ...currentTicketState,
              subject: `Asset Issue: ${assetNameParam || 'Asset'}`,
              asset_name: assetNameParam || ''
            };
          }

          // Try to load asset by ID first, then by name
          if (assetId) {
            try {
              const allAssets = await base44.entities.Asset.list();
              asset = allAssets.find(a => a.id === assetId);
            } catch (err) {
              console.error('Error loading asset by ID:', err);
            }
          }

          // Fallback to name search if no ID or asset not found
          if (!asset && assetNameParam && derivedBuildingId) {
            const assetsInBuilding = await base44.entities.Asset.filter({ building_id: derivedBuildingId });
            asset = assetsInBuilding.find(a => a.name === assetNameParam);
          }

          if (asset) {
            setSelectedAssetEntity(asset);
            setAssetSearch(asset.name);
            currentTicketState = {
              ...currentTicketState,
              asset_id: asset.id,
              asset_name: asset.name,
              room_id: asset.room_id || currentTicketState.room_id,
              floor_id: asset.floor_id || currentTicketState.floor_id,
              building_id: asset.building_id || currentTicketState.building_id
            };
          }
        }

        // Set asset context display
        if (assetId || assetNameParam) {
          const assetRoom = sortedRooms.find(r => r.id === currentTicketState.room_id);
          contextType = 'asset';
          contextDisplay = {
            primary: asset?.name || assetNameParam || 'Asset',
            secondary: assetRoom ? `${assetRoom.room_number || assetRoom.room_name} • ${building.name}` : building.name
          };
        }
      }
    }

    // Handle asset context without building (edge case)
    if ((assetId || assetNameParam) && !derivedBuildingId) {
      if (assetNameParam) setAssetSearch(assetNameParam);
      contextType = 'asset';
      contextDisplay = {
        primary: asset?.name || assetNameParam || 'Asset',
        secondary: 'Asset'
      };
      if (!currentTicketState.asset_name) {
        currentTicketState = {
          ...currentTicketState,
          asset_name: assetNameParam || asset?.name || '',
          subject: `Asset Issue: ${assetNameParam || asset?.name || 'Asset'}`
        };
      }
    }

    if (assetCategoryParam) {
      const mappedCategory = mapAssetCategoryToTicketCategory(assetCategoryParam);
      if (mappedCategory) {
        currentTicketState = {
          ...currentTicketState,
          category: mappedCategory
        };
        setSuggestedCategory(mappedCategory);
      }
    }

    setTicket(prev => ({...prev, ...currentTicketState}));
    setInferredContext({ type: contextType, display: contextDisplay });
    setContextLoaded(true);
  };

  // Auto-suggest category, priority based on context
  React.useEffect(() => {
    if (assetSearch || roomSearch || selectedBuilding) {
      generateSmartSuggestions();
    }
  }, [assetSearch, roomSearch, selectedBuilding]);

  const generateSmartSuggestions = async () => {
    try {
      let suggestedCat = "";
      let basePrio = "medium";
      const reasons = [];

      // Check for recurring issues (3+ tickets in 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const allTickets = await base44.entities.Ticket.list();
      let historicalTickets = [];

      if (selectedAssetEntity) {
        historicalTickets = allTickets.filter(t => 
          t.asset_id === selectedAssetEntity.id &&
          new Date(t.created_date) >= sixMonthsAgo
        );
      } else if (ticket.room_id) {
        historicalTickets = allTickets.filter(t => 
          t.room_id === ticket.room_id &&
          new Date(t.created_date) >= sixMonthsAgo
        );
      }

      if (historicalTickets.length >= 3) {
        setIsRecurring(true);
        reasons.push("recurring issue");
      }

      // Asset-based suggestions
      if (selectedAssetEntity) {
        const assetLower = selectedAssetEntity.name.toLowerCase();
        
        // Safety & Life Safety
        if (assetLower.includes('fire') || assetLower.includes('emergency') || 
            assetLower.includes('security') || assetLower.includes('life safety') ||
            assetLower.includes('sprinkler') || assetLower.includes('alarm')) {
          basePrio = "critical";
          reasons.push("life safety system");
        }
        // Core infrastructure
        else if (assetLower.includes('hvac') || assetLower.includes('network') || 
                 assetLower.includes('electrical') || assetLower.includes('plumbing') ||
                 assetLower.includes('water') || assetLower.includes('gas')) {
          basePrio = "high";
          reasons.push("core infrastructure");
        }
        // Technology
        else if (assetLower.includes('projector') || assetLower.includes('computer') || 
                 assetLower.includes('screen') || assetLower.includes('audio') || 
                 assetLower.includes('camera')) {
          suggestedCat = "technology";
          basePrio = "medium";
        }
      }

      // Check description for safety keywords
      if (issueDescription) {
        const descLower = issueDescription.toLowerCase();
        if (descLower.includes('fire') || descLower.includes('water leak') || 
            descLower.includes('flood') || descLower.includes('emergency') ||
            descLower.includes('safety') || descLower.includes('danger')) {
          basePrio = "critical";
          reasons.push("safety concern");
        }
      }

      // Room-based escalation
      if (ticket.room_id && basePrio !== "critical") {
        const roomLower = roomSearch.toLowerCase();
        if (roomLower.includes('sanctuary') || roomLower.includes('worship') || 
            roomLower.includes('chapel')) {
          basePrio = basePrio === "low" ? "medium" : basePrio === "medium" ? "high" : "high";
          reasons.push("affects worship space");
        } else {
          // +1 level for room-scoped
          basePrio = basePrio === "low" ? "medium" : basePrio === "medium" ? "high" : basePrio;
          reasons.push("affects room");
        }
      }

      // Building-scoped escalation (+2 levels)
      if (!assetSearch && !ticket.room_id && ticket.building_id && basePrio !== "critical") {
        basePrio = basePrio === "low" ? "high" : "critical";
        reasons.push("building-wide issue");
      }

      // Repeated ticket (+1 level)
      if (historicalTickets.length > 0 && historicalTickets.length < 3 && basePrio !== "critical") {
        basePrio = basePrio === "low" ? "medium" : basePrio === "medium" ? "high" : "critical";
        reasons.push("repeated issue");
      }

      if (suggestedCat) setSuggestedCategory(suggestedCat);
      setSuggestedPriority(basePrio);
      
      if (reasons.length > 0) {
        setPriorityReason(reasons.join(" + "));
      }
    } catch (error) {
      console.error('Error generating suggestions:', error);
    }
  };

  // Check for duplicate tickets before submission
  const checkDuplicateTickets = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const allTickets = await base44.entities.Ticket.list();
      const recentOpenTickets = allTickets.filter(t => {
        const isOpen = ['open', 'awaiting_information', 'awaiting_parts'].includes(t.status);
        const isRecent = new Date(t.created_date) >= thirtyDaysAgo;
        return isOpen && isRecent;
      });

      // Determine current scope based on IDs
      let currentScope = "BUILDING";
      if (ticket.asset_id) {
        currentScope = "ASSET";
      } else if (ticket.room_id) {
        currentScope = "ROOM";
      } else if (ticket.building_id) {
        currentScope = "BUILDING";
      }

      const duplicates = recentOpenTickets.filter(t => {
        // Match based on scope using IDs
        if (currentScope === "ASSET" && t.scope === "ASSET") {
          // Prefer asset_id matching when available
          if (urlAssetId && t.asset_id === urlAssetId) {
            return true;
          }
          // Fallback to asset_name matching if asset_id is missing
          if (!urlAssetId && assetSearch && t.asset_name?.toLowerCase() === assetSearch.toLowerCase()) {
            return true;
          }
        } else if (currentScope === "ROOM" && t.scope === "ROOM") {
          // Room match using room_id
          if (ticket.room_id && t.room_id === ticket.room_id) {
            return true;
          }
        } else if (currentScope === "BUILDING" && t.scope === "BUILDING") {
          // Building match using building_id
          if (ticket.building_id && t.building_id === ticket.building_id) {
            return true;
          }
        }
        return false;
      });

      if (duplicates.length > 0) {
        setDuplicateTickets(duplicates);
        setShowDuplicateWarning(true);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking duplicates:', error);
      return false;
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



  const loadBuildingsFromDB = async () => {
    setLoadingBuildings(true);
    try {
      const buildingsData = await base44.entities.Building.list();
      setBuildings(buildingsData);
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
    setTicket({
      ...ticket,
      building: building?.name || '',
      building_id: buildingId,
      room_id: '',
      room_number: '',
      asset_name: ''
    });

    // Load rooms for this building
    loadRoomsForBuilding(buildingId);
    setRoomAssets([]);
    setAssetSearch('');
  };

  const handleRoomChange = async (roomId) => {
    const room = rooms.find(r => r.id === roomId);
    setTicket({
      ...ticket,
      room_id: roomId,
      room_number: room?.room_number || null,
      floor_id: room?.floor_id || null
    });
    setRoomSearch(room?.room_number ? `${room.room_number} - ${room.room_name || 'Unnamed'}` : room?.room_name);

    // Load assets for this room
    if (roomId) {
      try {
        const assetsData = await base44.entities.Asset.filter({ room_id: roomId });
        setRoomAssets(assetsData);
      } catch (error) {
        console.error('Error loading assets:', error);
        setRoomAssets([]);
      }
    } else {
      setRoomAssets([]);
    }
  };

  const loadRoomsForBuilding = async (buildingId) => {
    if (!buildingId) return;
    
    setLoadingRooms(true);
    try {
      const roomsData = await base44.entities.Room.filter({ building_id: buildingId });
      const sortedRooms = roomsData.sort((a, b) => {
        const aNum = a.room_number || a.room_name || '';
        const bNum = b.room_number || b.room_name || '';
        return aNum.localeCompare(bNum, undefined, { numeric: true });
      });
      setRooms(sortedRooms);
    } catch (error) {
      console.error('Error loading rooms:', error);
      setRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  };

  const filteredRooms = rooms.filter(room => {
    if (!roomSearch) return true;
    const search = roomSearch.toLowerCase();
    const roomNum = (room.room_number || '').toLowerCase();
    const roomName = (room.room_name || '').toLowerCase();
    return roomNum.includes(search) || roomName.includes(search);
  });

  const filteredBuildings = buildings.filter(building => {
    if (!buildingSearch) return true;
    const search = buildingSearch.toLowerCase();
    const name = (building.name || '').toLowerCase();
    const address = (building.address || '').toLowerCase();
    return name.includes(search) || address.includes(search);
  });

  const filteredAssets = roomAssets.filter(asset => {
    if (!assetSearch) return true;
    const search = assetSearch.toLowerCase();
    const name = (asset.name || '').toLowerCase();
    const model = (asset.model || '').toLowerCase();
    return name.includes(search) || model.includes(search);
  });

  const availableCategories = [
    { value: 'technology', label: 'Technology' },
    { value: 'cleaning', label: 'Cleaning' },
    { value: 'maintenance', label: 'Maintenance' }
  ];

  const generateTicketTitle = async (description) => {
    if (!description || description.length < 10) return;
    
    setGeneratingTitle(true);
    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a short, clear ticket title (5-8 words max) for this issue:\n\n"${description}"\n\nRespond with ONLY the title, nothing else.`,
        add_context_from_internet: false
      });

      if (response) {
        setTicket(prev => ({...prev, subject: response.trim()}));
      }
    } catch (error) {
      console.error("Error generating title:", error);
    } finally {
      setGeneratingTitle(false);
    }
  };

  const generateTicketNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    return `TKT-${timestamp}`;
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

  const submitTicket = async ({ bypassDuplicates = false } = {}) => {
    if (!issueDescription || issueDescription.trim().length < 10) {
      toast.error("Please describe the issue (at least 10 characters)");
      return;
    }

    // Check for duplicates unless bypassed
    if (!bypassDuplicates) {
      const hasDuplicates = await checkDuplicateTickets();
      if (hasDuplicates) {
        return; // Show warning, let user decide
      }
    }

    // Auto-infer scope based on IDs only
    let inferredScope = "BUILDING";
    if (ticket.asset_id) {
      inferredScope = "ASSET";
    } else if (ticket.room_id) {
      inferredScope = "ROOM";
    } else if (ticket.building_id) {
      inferredScope = "BUILDING";
    }

    // Auto-suggest category/priority if not set
    const finalCategory = ticket.category || suggestedCategory || "maintenance";
    const finalPriority = ticket.priority || suggestedPriority || "medium";
    
    // Generate title if not already done
    if (!ticket.subject) {
      await generateTicketTitle(issueDescription);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(ticket.requester_email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setSubmitting(true);

    try {
      const newTicketNumber = generateTicketNumber();
      
      // Set due date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      // Determine final IDs based on scope
      let finalAssetId = null;
      let finalAssetName = null;
      let finalRoomId = ticket.room_id;
      let finalFloorId = ticket.floor_id;
      let finalBuildingId = ticket.building_id;

      if (inferredScope === "ASSET") {
        if (selectedAssetEntity) {
          finalAssetId = selectedAssetEntity.id;
          finalAssetName = selectedAssetEntity.name;
          finalRoomId = selectedAssetEntity.room_id || finalRoomId;
          finalFloorId = selectedAssetEntity.floor_id || finalFloorId;
          finalBuildingId = selectedAssetEntity.building_id || finalBuildingId;
        } else {
          finalAssetId = urlAssetId;
          finalAssetName = assetSearch;
        }
      }

      if (inferredScope === "ROOM" && finalRoomId) {
        const room = rooms.find(r => r.id === finalRoomId);
        if (room) {
          finalFloorId = room.floor_id || finalFloorId;
          finalBuildingId = room.building_id || finalBuildingId;
        }
      }

      if (inferredScope === "BUILDING" && selectedBuilding) {
        finalBuildingId = selectedBuilding.id;
      }
      
      // Determine assigned department and reason
      const { department: assignedDept, reason: deptReason } = determineAssignedDepartment(
        finalCategory,
        inferredScope,
        selectedAssetEntity
      );
      
      const ticketData = {
        ticket_number: newTicketNumber,
        requester_email: ticket.requester_email,
        requester_name: ticket.requester_name,
        subject: ticket.subject || issueDescription.substring(0, 50) + '...',
        description: issueDescription,
        scope: inferredScope,
        asset_id: finalAssetId,
        asset_name: finalAssetName,
        building: ticket.building,
        building_id: finalBuildingId,
        floor_id: finalFloorId,
        room_id: finalRoomId,
        room_number: ticket.room_number || null,
        status: "open",
        priority: finalPriority,
        priority_reason: priorityReason || null,
        category: finalCategory,
        assigned_department: assignedDept,
        assigned_department_reason: deptReason,
        recurring_issue: isRecurring,
        source: "web_form",
        due_date: tomorrowStr,
        attachments: ticket.attachments,
        last_activity_at: new Date().toISOString()
      };

      // Generate AI solution using ChatGPT
      try {
        const solution = await base44.integrations.Core.InvokeLLM({
          prompt: `You are a facilities/IT support expert at a church. Analyze this support ticket and provide a helpful solution or troubleshooting steps:\n\nIssue: ${issueDescription}\nCategory: ${finalCategory}\nBuilding: ${ticket.building || 'Not specified'}\nRoom: ${ticket.room_number || 'Not specified'}\n\nProvide a clear, actionable solution or next steps.`,
          add_context_from_internet: false
        });
        if (solution) {
          ticketData.suggested_solution = solution;
        }
      } catch (error) {
        console.error("Error generating AI solution:", error);
      }

      const createdTicket = await base44.entities.Ticket.create(ticketData);

      // Auto-assign ticket based on category
      try {
        await base44.functions.invoke('autoAssignTicket', {
          ticket_id: createdTicket.id
        });
      } catch (assignError) {
        console.warn('Auto-assignment failed:', assignError);
        // Don't fail ticket creation if assignment fails
      }

      // Notify workers about new ticket
      try {
        const rolesResponse = await base44.functions.invoke('getUsersWithTicketRoles');
        if (rolesResponse.data.success) {
          // Use assigned_department as source of truth, fallback to category mapping
          let department = ticketData.assigned_department;
          
          if (!department) {
            // Fallback: map from category
            const deptMap = {
              'technology': 'IT',
              'cleaning': 'Facilities',
              'maintenance': 'Facilities'
            };
            department = deptMap[ticketData.category] || null;
          }

          if (department) {
            const departmentWorkers = rolesResponse.data.allUsers.filter(user => 
              user.ticket_role === 'worker' && 
              user.departments && 
              user.departments.includes(department)
            );

            for (const worker of departmentWorkers) {
              await base44.functions.invoke('createNotification', {
                user_email: worker.user_email,
                type: 'ticket_assigned',
                title: `New Ticket: ${newTicketNumber}`,
                message: ticketData.subject,
                related_ticket_id: createdTicket.id,
                related_ticket_number: newTicketNumber,
                action_url: createPageUrl('SupportTickets') + `?id=${createdTicket.id}`,
                send_email: true
              });
            }
          }
        }
      } catch (notifyError) {
        console.warn('Worker notification failed:', notifyError);
      }

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    await submitTicket({ bypassDuplicates: false });
  };

  const handleReset = () => {
    setSubmitted(false);
    setTicketNumber("");
    setSelectedBuilding(null);
    setRooms([]);
    setTicket({
      requester_name: "",
      requester_email: "",
      building: "",
      building_id: "",
      floor_id: "",
      room_id: "",
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
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="inline-block p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl shadow-lg">
              <TicketIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Create Service Request
              </h1>
              {inferredContext.display && (
                <div className="mt-2">
                  <p className="text-xs text-slate-500 mb-1">Ticket will apply to:</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-sm">
                      {inferredContext.type === 'asset' && '🔧 Asset'}
                      {inferredContext.type === 'room' && '🚪 Room'}
                      {inferredContext.type === 'building' && '🏢 Building'}
                    </Badge>
                    <span className="text-slate-900 text-sm font-medium">
                      {inferredContext.display.primary}
                    </span>
                    {inferredContext.display.secondary && (
                      <span className="text-slate-500 text-xs">
                        • {inferredContext.display.secondary}
                      </span>
                    )}
                    </div>
                    </div>
                    )}
                    </div>
                    </div>
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
                {/* Requester identity fields - always visible */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Name
                    </label>
                    <Input
                      value={ticket.requester_name}
                      onChange={(e) => setTicket({...ticket, requester_name: e.target.value})}
                      placeholder="Your full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Email Address
                    </label>
                    <Input
                      type="email"
                      value={ticket.requester_email}
                      onChange={(e) => setTicket({...ticket, requester_email: e.target.value})}
                      placeholder="your.email@fbca.org"
                      disabled={!!ticket.requester_email}
                      className={!!ticket.requester_email ? 'bg-slate-50' : ''}
                    />
                  </div>
                </div>

                {/* Location fields - always show, pre-fill if context exists */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2 relative">
                    <label className="text-sm font-medium">Building</label>
                    {loadingBuildings ? (
                      <div className="flex items-center justify-center h-10 border rounded-md">
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      </div>
                    ) : (
                      <div className="relative">
                        <Input
                          value={buildingSearch}
                          onChange={(e) => {
                            setBuildingSearch(e.target.value);
                            setShowBuildingDropdown(true);
                          }}
                          onFocus={() => setShowBuildingDropdown(true)}
                          placeholder="Search buildings..."
                          className="pr-8"
                        />
                        {ticket.building_id && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                            onClick={() => {
                              setTicket({...ticket, building: '', building_id: '', room_id: '', room_number: '', floor_id: null});
                              setBuildingSearch('');
                              setRooms([]);
                              setSelectedBuilding(null);
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                        {showBuildingDropdown && filteredBuildings.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                            {filteredBuildings.map(building => (
                              <div
                                key={building.id}
                                className="px-3 py-2 hover:bg-slate-100 cursor-pointer text-sm"
                                onClick={() => {
                                  handleBuildingChange(building.id);
                                  setBuildingSearch(building.name);
                                  setShowBuildingDropdown(false);
                                }}
                              >
                                <div className="font-medium">{building.name}</div>
                                {building.address && (
                                  <div className="text-xs text-slate-500">{building.address}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 relative">
                    <label className="text-sm font-medium">Room</label>
                    {loadingRooms ? (
                      <div className="flex items-center justify-center h-10 border rounded-md">
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      </div>
                    ) : selectedBuilding && rooms.length > 0 ? (
                      <div className="relative">
                        <Input
                          value={roomSearch}
                          onChange={(e) => {
                            setRoomSearch(e.target.value);
                            setShowRoomDropdown(true);
                          }}
                          onFocus={() => setShowRoomDropdown(true)}
                          placeholder="Search rooms..."
                          className="pr-8"
                        />
                        {ticket.room_id && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                            onClick={() => {
                              setTicket({...ticket, room_id: '', room_number: '', floor_id: null});
                              setRoomSearch('');
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                        {showRoomDropdown && filteredRooms.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                            {filteredRooms.slice(0, 50).map(room => (
                              <div
                                key={room.id}
                                className="px-3 py-2 hover:bg-slate-100 cursor-pointer text-sm"
                                onClick={() => {
                                  handleRoomChange(room.id);
                                  setShowRoomDropdown(false);
                                }}
                              >
                                {room.room_number ? `${room.room_number} - ${room.room_name || 'Unnamed'}` : room.room_name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <Input
                        value={ticket.room_number}
                        onChange={(e) => setTicket({...ticket, room_number: e.target.value})}
                        placeholder={selectedBuilding ? "Type room number..." : "Select building first"}
                        disabled={!selectedBuilding}
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    What's going on?<span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    value={issueDescription}
                    onChange={(e) => {
                      setIssueDescription(e.target.value);
                    }}
                    onBlur={(e) => {
                      if (e.target.value) generateTicketTitle(e.target.value);
                    }}
                    placeholder="Describe the issue you're experiencing..."
                    rows={4}
                    required
                    className="text-base"
                  />
                  <p className="text-xs text-slate-500">
                    Be specific about what's not working or what you need help with
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      Category
                    {suggestedCategory && !ticket.category && (
                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                        Suggested: {availableCategories.find(c => c.value === suggestedCategory)?.label}
                      </Badge>
                    )}
                  </label>
                  <Select 
                    value={ticket.category || suggestedCategory} 
                    onValueChange={(value) => setTicket({...ticket, category: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Auto-suggested based on details..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCategories.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                          {cat.value === suggestedCategory && !ticket.category && " (Suggested)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">Auto-suggested based on issue details</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    Priority
                    {suggestedPriority !== "medium" && !ticket.priority && (
                      <Badge variant="outline" className={`text-xs ${
                        suggestedPriority === 'critical' ? 'bg-red-50 text-red-700 border-red-200' :
                        suggestedPriority === 'high' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                        'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        Suggested: {suggestedPriority}
                      </Badge>
                    )}
                  </label>
                  <Select 
                    value={ticket.priority || suggestedPriority} 
                    onValueChange={(value) => setTicket({...ticket, priority: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium {suggestedPriority === "medium" && !ticket.priority ? "(Suggested)" : ""}</SelectItem>
                      <SelectItem value="high">High {suggestedPriority === "high" && !ticket.priority ? "(Suggested)" : ""}</SelectItem>
                      <SelectItem value="critical">Critical {suggestedPriority === "critical" && !ticket.priority ? "(Suggested)" : ""}</SelectItem>
                    </SelectContent>
                  </Select>
                  {priorityReason && (
                    <p className="text-xs text-slate-600 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Suggested {suggestedPriority} — {priorityReason}
                    </p>
                  )}
                  {isRecurring && (
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-md p-2">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <p className="text-xs text-amber-800 font-medium">
                        Recurring Issue: 3+ tickets here in 6 months
                      </p>
                    </div>
                  )}
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

                <div className="pt-4 border-t">
                  <Button 
                    type="submit" 
                    disabled={submitting || !issueDescription.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Creating Request...
                      </>
                    ) : (
                      "Create Request"
                    )}
                  </Button>
                  <p className="text-xs text-center text-slate-500 mt-3">
                    We'll route this to the right team automatically
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* Duplicate Warning Dialog */}
        <AnimatePresence>
          {showDuplicateWarning && duplicateTickets.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setShowDuplicateWarning(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 mb-4">
                  <AlertCircle className="w-6 h-6 text-orange-500" />
                  <h3 className="text-lg font-bold text-slate-900">Similar Open Tickets Found</h3>
                </div>
                
                <p className="text-sm text-slate-600 mb-4">
                  We found {duplicateTickets.length} open ticket{duplicateTickets.length > 1 ? 's' : ''} for this {selectedAssetEntity ? 'asset' : 'room'} from the last 30 days:
                </p>

                <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
                  {duplicateTickets.map(dup => (
                    <div key={dup.id} className="border-2 border-blue-200 rounded-lg p-3 bg-blue-50">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-slate-900 truncate">{dup.subject}</p>
                          <p className="text-xs text-slate-600 mt-1">{dup.ticket_number} • {dup.status.replace('_', ' ')}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            Created {format(new Date(dup.created_date), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => navigate(createPageUrl('TicketDetail') + `?id=${dup.id}`)}
                          size="sm"
                          className="flex-1 bg-blue-600 hover:bg-blue-700"
                        >
                          Use This Ticket
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            window.open(createPageUrl('TicketDetail') + `?id=${dup.id}`, '_blank');
                          }}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowDuplicateWarning(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={async () => {
                      setShowDuplicateWarning(false);
                      await submitTicket({ bypassDuplicates: true });
                    }}
                    variant="outline"
                    className="flex-1 text-slate-600"
                  >
                    Create New Anyway
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}