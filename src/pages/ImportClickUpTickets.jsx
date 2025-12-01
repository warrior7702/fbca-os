import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { 
  CheckSquare, 
  Loader2, 
  ArrowLeft,
  Check,
  Upload
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [listId, setListId] = useState("900600901397");
  const [tasks, setTasks] = useState([]);
  const [selectedTasks, setSelectedTasks] = useState({});
  const [categoryMapping, setCategoryMapping] = useState({});
  const [importResults, setImportResults] = useState(null);

  const categories = ["technology", "cleaning", "maintenance"];

  const fetchTasks = async () => {
    if (!listId.trim()) {
      toast.error("Enter a list ID");
      return;
    }
    setLoading(true);
    setTasks([]);
    try {
      const response = await base44.functions.invoke('getClickUpTasksByList', { listId: listId.trim() });
      const fetchedTasks = response.data.tasks || [];
      setTasks(fetchedTasks);
      toast.success(`Found ${fetchedTasks.length} tasks`);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to fetch tasks");
    } finally {
      setLoading(false);
    }
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

  const selectNone = () => setSelectedTasks({});

  const selectedCount = Object.values(selectedTasks).filter(Boolean).length;

  const generateTicketNumber = (existingNumbers) => {
    let maxNum = 0;
    existingNumbers.forEach(num => {
      const n = parseInt(num?.replace('TKT-', '') || '0');
      if (n > maxNum) maxNum = n;
    });
    return `TKT-${String(maxNum + 1).padStart(6, '0')}`;
  };

  const importSelected = async () => {
    const toImport = tasks.filter(t => selectedTasks[t.id]);
    if (toImport.length === 0) {
      toast.error("Select tasks to import");
      return;
    }

    setImporting(true);
    const results = { success: 0, skipped: 0, failed: 0 };

    try {
      const existingTickets = await base44.entities.Ticket.list();
      const existingIds = new Set(existingTickets.map(t => t.tags?.find(tag => tag.startsWith('clickup:'))?.replace('clickup:', '')));
      const existingNumbers = existingTickets.map(t => t.ticket_number);

      for (const task of toImport) {
        if (existingIds.has(task.id)) {
          results.skipped++;
          continue;
        }

        try {
          const ticketNumber = generateTicketNumber(existingNumbers);
          existingNumbers.push(ticketNumber);

          // Map priority
          let priority = 'medium';
          if (task.priority === 1) priority = 'urgent';
          else if (task.priority === 2) priority = 'high';
          else if (task.priority === 4) priority = 'low';

          await base44.entities.Ticket.create({
            ticket_number: ticketNumber,
            subject: task.name,
            description: task.description || task.name,
            status: 'open',
            priority,
            category: categoryMapping[task.id] || 'maintenance',
            tags: [`clickup:${task.id}`],
            source: 'workflow',
            due_date: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : null,
            last_activity_at: new Date().toISOString()
          });

          results.success++;
        } catch (error) {
          console.error("Error creating ticket:", error);
          results.failed++;
        }
      }

      setImportResults(results);
      toast.success(`Imported ${results.success} tickets`);
      
      // Clear imported tasks from selection
      const newSelected = { ...selectedTasks };
      toImport.forEach(t => delete newSelected[t.id]);
      setSelectedTasks(newSelected);
      
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="h-full bg-gradient-to-br from-purple-50 to-indigo-50 p-6 overflow-auto">
      <div className="max-w-4xl mx-auto space-y-6">
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
            <p className="text-slate-600">Fetch tasks by list ID</p>
          </div>
        </div>

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
              </div>
            </CardContent>
          </Card>
        )}

        {/* List ID Input */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Input
                placeholder="ClickUp List ID (e.g., 900600901397)"
                value={listId}
                onChange={(e) => setListId(e.target.value)}
                className="flex-1"
              />
              <Button onClick={fetchTasks} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Fetch Tasks"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tasks */}
        {tasks.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll}>Select All</Button>
                  <Button variant="outline" size="sm" onClick={selectNone}>Clear</Button>
                  <span className="text-sm text-slate-500">{selectedCount} selected</span>
                </div>
                {selectedCount > 0 && (
                  <Button 
                    onClick={importSelected}
                    disabled={importing}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {importing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    Import {selectedCount}
                  </Button>
                )}
              </div>

              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {tasks.map(task => (
                  <div 
                    key={task.id} 
                    className={`p-3 rounded-lg border ${selectedTasks[task.id] ? 'bg-purple-50 border-purple-300' : 'bg-white'}`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={!!selectedTasks[task.id]}
                        onCheckedChange={() => toggleTask(task.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{task.name}</span>
                          <Badge variant="outline">{task.status}</Badge>
                          {task.priorityName && (
                            <Badge variant="secondary">{task.priorityName}</Badge>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-sm text-slate-500 mt-1 line-clamp-2">{task.description}</p>
                        )}
                        <div className="text-xs text-slate-400 mt-1">
                          ID: {task.id}
                          {task.assignees?.length > 0 && ` • Assignees: ${task.assignees.join(', ')}`}
                        </div>
                      </div>
                      <Select
                        value={categoryMapping[task.id] || 'maintenance'}
                        onValueChange={(val) => setCategoryMapping(prev => ({ ...prev, [task.id]: val }))}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}