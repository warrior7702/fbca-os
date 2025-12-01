import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { 
  CheckSquare, 
  Download, 
  Loader2, 
  ArrowLeft,
  RefreshCw,
  Check,
  List,
  FolderOpen
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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

export default function ImportClickUpTickets() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingLists, setLoadingLists] = useState(false);
  const [fetchingTasks, setFetchingTasks] = useState(false);
  const [importing, setImporting] = useState(false);
  
  const [lists, setLists] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [selectedTasks, setSelectedTasks] = useState({});
  const [importResults, setImportResults] = useState(null);
  const [existingTickets, setExistingTickets] = useState([]);

  const [categoryMapping, setCategoryMapping] = useState({});
  const categories = ["technology", "cleaning", "maintenance"];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const tickets = await base44.entities.Ticket.list();
      setExistingTickets(tickets);

      if (currentUser.clickup_access_token) {
        await fetchLists();
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLists = async () => {
    setLoadingLists(true);
    try {
      const response = await base44.functions.invoke('getClickUpLists');
      setLists(response.data.lists || []);
    } catch (error) {
      console.error("Error fetching lists:", error);
      toast.error("Failed to fetch ClickUp lists");
    } finally {
      setLoadingLists(false);
    }
  };

  const fetchTasksForList = async (listId) => {
    setFetchingTasks(true);
    setTasks([]);
    setSelectedTasks({});
    try {
      const response = await base44.functions.invoke('getClickUpTasksByList', { listId });
      const clickupTasks = response.data.tasks || [];
      setTasks(clickupTasks);
      toast.success(`Found ${clickupTasks.length} tasks`);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast.error("Failed to fetch tasks");
    } finally {
      setFetchingTasks(false);
    }
  };

  const handleListSelect = (listId) => {
    const list = lists.find(l => l.id === listId);
    setSelectedList(list);
    fetchTasksForList(listId);
  };

  const toggleTask = (taskId) => {
    setSelectedTasks(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  const selectAll = () => {
    const allSelected = {};
    tasks.forEach(t => allSelected[t.id] = true);
    setSelectedTasks(allSelected);
  };

  const deselectAll = () => {
    setSelectedTasks({});
  };

  const setCategoryForTask = (taskId, category) => {
    setCategoryMapping(prev => ({
      ...prev,
      [taskId]: category
    }));
  };

  const generateTicketNumber = async () => {
    const allTickets = await base44.entities.Ticket.list('-created_date', 1);
    if (allTickets.length === 0) return 'TKT-000001';
    
    const lastNumber = allTickets[0].ticket_number;
    const num = parseInt(lastNumber?.replace('TKT-', '') || '0') + 1;
    return `TKT-${String(num).padStart(6, '0')}`;
  };

  const importSelectedTasks = async () => {
    const tasksToImport = tasks.filter(t => selectedTasks[t.id]);
    
    if (tasksToImport.length === 0) {
      toast.error("Please select at least one task to import");
      return;
    }

    setImporting(true);
    const results = { success: 0, skipped: 0, failed: 0, details: [] };

    try {
      for (const task of tasksToImport) {
        // Check if already imported (by checking if subject matches)
        const alreadyExists = existingTickets.some(t => 
          t.subject?.toLowerCase() === task.name?.toLowerCase()
        );

        if (alreadyExists) {
          results.skipped++;
          results.details.push({ name: task.name, status: 'skipped', reason: 'Already exists' });
          continue;
        }

        try {
          const ticketNumber = await generateTicketNumber();
          
          // Map ClickUp priority to ticket priority
          let priority = 'medium';
          if (task.priority === 1 || task.priority === 'urgent') priority = 'urgent';
          else if (task.priority === 2 || task.priority === 'high') priority = 'high';
          else if (task.priority === 4 || task.priority === 'low') priority = 'low';

          // Map status
          let status = 'open';
          const taskStatus = task.status?.toLowerCase() || '';
          if (taskStatus.includes('progress') || taskStatus.includes('working')) {
            status = 'open';
          } else if (taskStatus.includes('waiting') || taskStatus.includes('blocked')) {
            status = 'awaiting_information';
          }

          const ticket = await base44.entities.Ticket.create({
            ticket_number: ticketNumber,
            subject: task.name,
            description: task.description || task.text_content || `Imported from ClickUp: ${task.name}`,
            status: status,
            priority: priority,
            category: categoryMapping[task.id] || 'maintenance',
            requester_email: user.email,
            requester_name: user.full_name || user.email,
            source: 'workflow',
            tags: ['clickup-import'],
            due_date: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : null,
            last_activity_at: new Date().toISOString()
          });

          results.success++;
          results.details.push({ name: task.name, status: 'success', ticketNumber });
          
          // Update existingTickets to prevent duplicates in same batch
          existingTickets.push(ticket);
        } catch (error) {
          console.error("Error creating ticket:", error);
          results.failed++;
          results.details.push({ name: task.name, status: 'failed', reason: error.message });
        }
      }

      setImportResults(results);
      toast.success(`Imported ${results.success} tickets`);
      
      // Clear selections
      setSelectedTasks({});
      
      // Refresh tasks list
      await fetchClickUpTasks();
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Import failed: " + error.message);
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = Object.values(selectedTasks).filter(Boolean).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!user?.clickup_access_token) {
    return (
      <div className="h-full bg-gradient-to-br from-purple-50 to-indigo-50 p-6 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-20">
              <CheckSquare className="w-16 h-16 text-slate-300 mb-4" />
              <p className="text-slate-600 mb-4">ClickUp is not connected</p>
              <Link to={createPageUrl('Settings') + '?tab=integrations'}>
                <Button>Connect ClickUp</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-purple-50 to-indigo-50 p-6 overflow-auto">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
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
            <p className="text-slate-600">Select a list, then choose tasks to import</p>
          </div>
        </div>

        {/* List Selector */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-purple-600" />
                <span className="font-medium">Select List:</span>
              </div>
              {loadingLists ? (
                <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
              ) : (
                <Select value={selectedList?.id || ""} onValueChange={handleListSelect}>
                  <SelectTrigger className="w-72">
                    <SelectValue placeholder="Choose a ClickUp list..." />
                  </SelectTrigger>
                  <SelectContent>
                    {lists.map(list => (
                      <SelectItem key={list.id} value={list.id}>
                        <div className="flex items-center gap-2">
                          <span>{list.name}</span>
                          <span className="text-xs text-slate-400">
                            ({list.space}{list.folder ? ` / ${list.folder}` : ''})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selectedList && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => fetchTasksForList(selectedList.id)}
                  disabled={fetchingTasks}
                >
                  <RefreshCw className={`w-4 h-4 mr-1 ${fetchingTasks ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Import Results */}
        {importResults && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Check className="w-8 h-8 text-green-600" />
                <div>
                  <p className="font-semibold text-green-900">Import Complete</p>
                  <p className="text-sm text-green-700">
                    {importResults.success} imported, {importResults.skipped} skipped, {importResults.failed} failed
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="ml-auto"
                  onClick={() => setImportResults(null)}
                >
                  Dismiss
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Selection Actions */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>
                  Deselect All
                </Button>
                <Badge variant="secondary" className="ml-2">
                  {selectedCount} selected
                </Badge>
              </div>
              <Button 
                onClick={importSelectedTasks}
                disabled={selectedCount === 0 || importing}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Import {selectedCount} Tasks
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tasks List */}
        {!selectedList ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-20">
              <FolderOpen className="w-16 h-16 text-slate-300 mb-4" />
              <p className="text-slate-500">Select a list above to view tasks</p>
            </CardContent>
          </Card>
        ) : fetchingTasks ? (
          <Card>
            <CardContent className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </CardContent>
          </Card>
        ) : tasks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-20">
              <List className="w-16 h-16 text-slate-300 mb-4" />
              <p className="text-slate-500">No open tasks found in this list</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => {
              const isSelected = selectedTasks[task.id];
              const alreadyExists = existingTickets.some(t => 
                t.subject?.toLowerCase() === task.name?.toLowerCase()
              );

              return (
                <Card 
                  key={task.id} 
                  className={`transition-all ${isSelected ? 'border-purple-400 bg-purple-50' : ''} ${alreadyExists ? 'opacity-60' : ''}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleTask(task.id)}
                        disabled={alreadyExists}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-900 truncate">
                            {task.name}
                          </h3>
                          {alreadyExists && (
                            <Badge variant="outline" className="text-orange-600 border-orange-300">
                              Already Imported
                            </Badge>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-sm text-slate-600 line-clamp-2 mb-2">
                            {task.description || task.text_content}
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <Badge variant="secondary">{task.status || 'No status'}</Badge>
                          {task.priority && (
                            <Badge variant="outline">
                              Priority: {typeof task.priority === 'number' ? 
                                ['', 'Urgent', 'High', 'Normal', 'Low'][task.priority] || task.priority 
                                : task.priority}
                            </Badge>
                          )}
                          {task.due_date && (
                            <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <Select
                          value={categoryMapping[task.id] || 'maintenance'}
                          onValueChange={(val) => setCategoryForTask(task.id, val)}
                          disabled={alreadyExists}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue placeholder="Category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map(cat => (
                              <SelectItem key={cat} value={cat}>
                                {cat.charAt(0).toUpperCase() + cat.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}