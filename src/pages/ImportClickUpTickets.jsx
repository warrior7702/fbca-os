import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { 
  CheckSquare, 
  Loader2, 
  ArrowLeft,
  Check,
  Upload,
  ChevronRight,
  Edit3,
  X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ImportClickUpTickets() {
  const [step, setStep] = useState(1); // 1=fetch, 2=select, 3=review, 4=done
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [listId, setListId] = useState("900600901397");
  const [tasks, setTasks] = useState([]);
  const [selectedTasks, setSelectedTasks] = useState({});
  const [ticketData, setTicketData] = useState({}); // task.id -> ticket fields
  const [editingTask, setEditingTask] = useState(null);
  const [importResults, setImportResults] = useState(null);

  const categories = ["technology", "cleaning", "maintenance"];
  const priorities = ["low", "medium", "high", "urgent"];
  const statuses = ["open", "awaiting_information", "awaiting_parts", "resolved"];

  const fetchTasks = async () => {
    if (!listId.trim()) {
      toast.error("Enter a list ID");
      return;
    }
    setLoading(true);
    try {
      const response = await base44.functions.invoke('getClickUpTasksByList', { listId: listId.trim() });
      const fetchedTasks = response.data.tasks || [];
      setTasks(fetchedTasks);
      
      // Pre-populate ticket data from ClickUp fields
      const initialData = {};
      fetchedTasks.forEach(task => {
        // Map priority
        let priority = 'medium';
        if (task.priority === 1) priority = 'urgent';
        else if (task.priority === 2) priority = 'high';
        else if (task.priority === 4) priority = 'low';

        // Try to detect category from tags or folder
        let category = 'maintenance';
        const allText = [task.folder, task.list, ...task.tags].join(' ').toLowerCase();
        if (allText.includes('tech') || allText.includes('it ')) category = 'technology';
        else if (allText.includes('clean')) category = 'cleaning';

        // Get requester from custom fields or creator
        let requesterName = task.creator?.username || '';
        let requesterEmail = task.creator?.email || '';
        let location = '';
        
        task.custom_fields?.forEach(cf => {
          const name = cf.name?.toLowerCase() || '';
          if (name.includes('requester') || name.includes('name')) {
            if (cf.value && typeof cf.value === 'string') requesterName = cf.value;
          }
          if (name.includes('email')) {
            if (cf.value && typeof cf.value === 'string') requesterEmail = cf.value;
          }
          if (name.includes('room') || name.includes('location') || name.includes('building')) {
            if (cf.value && typeof cf.value === 'string') location = cf.value;
          }
        });

        initialData[task.id] = {
          subject: task.name,
          description: task.description || '',
          priority,
          category,
          status: 'open',
          requester_name: requesterName,
          requester_email: requesterEmail,
          room_number: location,
          assigned_to_name: task.assignees?.[0]?.username || '',
          assigned_to_email: task.assignees?.[0]?.email || '',
          clickup_url: task.url,
          tags: task.tags || []
        };
      });
      setTicketData(initialData);
      
      toast.success(`Found ${fetchedTasks.length} tasks`);
      setStep(2);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to fetch tasks: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = (taskId) => {
    setSelectedTasks(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const selectAll = () => {
    const all = {};
    tasks.forEach(t => all[t.id] = true);
    setSelectedTasks(all);
  };

  const selectNone = () => setSelectedTasks({});

  const selectedCount = Object.values(selectedTasks).filter(Boolean).length;
  const selectedTasksList = tasks.filter(t => selectedTasks[t.id]);

  const updateTicketField = (taskId, field, value) => {
    setTicketData(prev => ({
      ...prev,
      [taskId]: { ...prev[taskId], [field]: value }
    }));
  };

  const generateTicketNumber = (existingNumbers) => {
    let maxNum = 0;
    existingNumbers.forEach(num => {
      const n = parseInt(num?.replace('TKT-', '') || '0');
      if (n > maxNum) maxNum = n;
    });
    return `TKT-${String(maxNum + 1).padStart(6, '0')}`;
  };

  const importTickets = async () => {
    setImporting(true);
    const results = { success: 0, skipped: 0, failed: 0, tickets: [] };

    try {
      const existingTickets = await base44.entities.Ticket.list();
      const existingClickUpIds = new Set(
        existingTickets
          .flatMap(t => t.tags || [])
          .filter(tag => tag.startsWith('clickup:'))
          .map(tag => tag.replace('clickup:', ''))
      );
      const existingNumbers = existingTickets.map(t => t.ticket_number);

      for (const task of selectedTasksList) {
        if (existingClickUpIds.has(task.id)) {
          results.skipped++;
          continue;
        }

        try {
          const data = ticketData[task.id];
          const ticketNumber = generateTicketNumber(existingNumbers);
          existingNumbers.push(ticketNumber);

          const newTicket = await base44.entities.Ticket.create({
            ticket_number: ticketNumber,
            subject: data.subject,
            description: data.description || data.subject,
            status: data.status,
            priority: data.priority,
            category: data.category,
            requester_name: data.requester_name,
            requester_email: data.requester_email,
            room_number: data.room_number,
            assigned_to_name: data.assigned_to_name,
            assigned_to: data.assigned_to_email,
            tags: [`clickup:${task.id}`, ...(data.tags || [])],
            source: 'workflow',
            last_activity_at: new Date().toISOString()
          });

          results.success++;
          results.tickets.push({ number: ticketNumber, subject: data.subject });
        } catch (error) {
          console.error("Error creating ticket:", error);
          results.failed++;
        }
      }

      setImportResults(results);
      setStep(4);
      toast.success(`Imported ${results.success} tickets`);
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Import failed: " + error.message);
    } finally {
      setImporting(false);
    }
  };

  const goToReview = () => {
    if (selectedCount === 0) {
      toast.error("Select at least one task");
      return;
    }
    setStep(3);
  };

  return (
    <div className="h-full bg-gradient-to-br from-purple-50 to-indigo-50 p-6 overflow-auto">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to={createPageUrl('Ticketing')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl shadow-lg">
            <CheckSquare className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Import from ClickUp</h1>
            <p className="text-slate-600">Step {step} of 4</p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                s === step ? 'bg-purple-600 text-white' : 
                s < step ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'
              }`}>
                {s < step ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < 4 && <ChevronRight className="w-4 h-4 text-slate-300 mx-1" />}
            </div>
          ))}
          <span className="ml-3 text-sm text-slate-500">
            {step === 1 && "Fetch Tasks"}
            {step === 2 && "Select Tasks"}
            {step === 3 && "Review & Edit"}
            {step === 4 && "Complete"}
          </span>
        </div>

        {/* Step 1: Fetch */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Enter ClickUp List ID</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600">
                Find the list ID in your ClickUp URL: app.clickup.com/.../li/<strong>LIST_ID</strong>
              </p>
              <div className="flex gap-3">
                <Input
                  placeholder="e.g., 900600901397"
                  value={listId}
                  onChange={(e) => setListId(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={fetchTasks} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Fetch Tasks
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Select */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Select Tasks to Import ({tasks.length} found)</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setStep(1)}>Back</Button>
                  <Button onClick={goToReview} disabled={selectedCount === 0}>
                    Review {selectedCount} Selected <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>Select All</Button>
                <Button variant="outline" size="sm" onClick={selectNone}>Clear</Button>
                <span className="text-sm text-slate-500">{selectedCount} selected</span>
              </div>

              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {tasks.map(task => (
                  <div 
                    key={task.id} 
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedTasks[task.id] ? 'bg-purple-50 border-purple-300' : 'bg-white hover:bg-slate-50'
                    }`}
                    onClick={() => toggleTask(task.id)}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={!!selectedTasks[task.id]}
                        onCheckedChange={() => toggleTask(task.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium">{task.name}</span>
                          <Badge variant="outline">{task.status}</Badge>
                          {task.priorityName && <Badge variant="secondary">{task.priorityName}</Badge>}
                        </div>
                        <div className="text-sm text-slate-600 space-y-1">
                          {task.assignees?.length > 0 && (
                            <div>👤 Assigned: {task.assignees.map(a => a.username || a.email).join(', ')}</div>
                          )}
                          {task.folder && <div>📁 Folder: {task.folder}</div>}
                          {task.tags?.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              🏷️ {task.tags.map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                            </div>
                          )}
                          {task.custom_fields?.filter(cf => cf.value).slice(0, 3).map(cf => (
                            <div key={cf.name}>📋 {cf.name}: {String(cf.value)}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Review & Edit */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Review & Edit ({selectedCount} tickets)</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                  <Button onClick={importTickets} disabled={importing} className="bg-green-600 hover:bg-green-700">
                    {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                    Import All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {selectedTasksList.map(task => {
                  const data = ticketData[task.id];
                  return (
                    <div key={task.id} className="p-4 bg-white rounded-lg border">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <Label className="text-xs text-slate-500">Subject</Label>
                            <div className="font-medium truncate">{data.subject}</div>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Category</Label>
                            <Badge>{data.category}</Badge>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Priority</Label>
                            <Badge variant="secondary">{data.priority}</Badge>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Assigned To</Label>
                            <div>{data.assigned_to_name || 'Unassigned'}</div>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Requester</Label>
                            <div>{data.requester_name || data.requester_email || 'Unknown'}</div>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Location</Label>
                            <div>{data.room_number || '-'}</div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setEditingTask(task)}>
                          <Edit3 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Complete */}
        {step === 4 && importResults && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-6 text-center">
              <Check className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-green-900 mb-2">Import Complete!</h2>
              <p className="text-green-700 mb-4">
                {importResults.success} imported, {importResults.skipped} skipped, {importResults.failed} failed
              </p>
              <div className="flex justify-center gap-3">
                <Link to={createPageUrl('SupportTickets')}>
                  <Button>View Tickets</Button>
                </Link>
                <Button variant="outline" onClick={() => { setStep(1); setTasks([]); setSelectedTasks({}); setImportResults(null); }}>
                  Import More
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Ticket Details</DialogTitle>
            </DialogHeader>
            {editingTask && (
              <div className="space-y-4">
                <div>
                  <Label>Subject</Label>
                  <Input 
                    value={ticketData[editingTask.id]?.subject || ''} 
                    onChange={(e) => updateTicketField(editingTask.id, 'subject', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea 
                    value={ticketData[editingTask.id]?.description || ''} 
                    onChange={(e) => updateTicketField(editingTask.id, 'description', e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Category</Label>
                    <Select 
                      value={ticketData[editingTask.id]?.category} 
                      onValueChange={(v) => updateTicketField(editingTask.id, 'category', v)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <Select 
                      value={ticketData[editingTask.id]?.priority} 
                      onValueChange={(v) => updateTicketField(editingTask.id, 'priority', v)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {priorities.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Requester Name</Label>
                    <Input 
                      value={ticketData[editingTask.id]?.requester_name || ''} 
                      onChange={(e) => updateTicketField(editingTask.id, 'requester_name', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Requester Email</Label>
                    <Input 
                      value={ticketData[editingTask.id]?.requester_email || ''} 
                      onChange={(e) => updateTicketField(editingTask.id, 'requester_email', e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Assigned To</Label>
                    <Input 
                      value={ticketData[editingTask.id]?.assigned_to_name || ''} 
                      onChange={(e) => updateTicketField(editingTask.id, 'assigned_to_name', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Location/Room</Label>
                    <Input 
                      value={ticketData[editingTask.id]?.room_number || ''} 
                      onChange={(e) => updateTicketField(editingTask.id, 'room_number', e.target.value)}
                    />
                  </div>
                </div>
                <Button className="w-full" onClick={() => setEditingTask(null)}>Done</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}