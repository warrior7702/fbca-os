import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { 
  Upload, 
  Loader2, 
  ArrowLeft,
  Check,
  FileText,
  AlertCircle
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function ImportTickets() {
  const [importing, setImporting] = useState(false);
  const [rawData, setRawData] = useState("");
  const [parsedTickets, setParsedTickets] = useState([]);
  const [importResults, setImportResults] = useState(null);

  const parseClickUpData = () => {
    if (!rawData.trim()) {
      toast.error("Please paste your ticket data");
      return;
    }

    try {
      const lines = rawData.trim().split('\n');
      const tickets = [];

      for (const line of lines) {
        if (!line.trim()) continue;
        
        const cols = line.split('\t');
        if (cols.length < 5) continue;
        
        // Skip header row
        if (cols[0] === 'Ticket' || cols[0] === 'Task') {
          // Check if it's actually a data row by looking at ID format
          if (!cols[1] || cols[1].length < 5) continue;
        }

        const type = cols[0]?.trim();
        const clickupId = cols[1]?.trim();
        const subject = cols[2]?.trim();
        const status = cols[3]?.trim()?.toLowerCase();
        const assigneesRaw = cols[5]?.trim();
        const description = cols[6]?.trim()?.replace(/^"|"$/g, '');
        const priorityRaw = cols[8]?.trim()?.toUpperCase();
        const requesterEmail = cols[41]?.trim() || cols[42]?.trim();
        const requesterName = cols[44]?.trim() || cols[43]?.trim();
        const location = cols[48]?.trim();
        const categoryRaw = cols[49]?.trim();

        if (!subject) continue;

        // Map status
        let ticketStatus = 'open';
        if (status === 'working' || status === 'in progress') ticketStatus = 'open';
        else if (status === 'paused' || status === 'waiting') ticketStatus = 'awaiting_parts';
        else if (status === 'unassigned' || status === 'requested') ticketStatus = 'open';
        else if (status === 'complete' || status === 'closed' || status === 'done') ticketStatus = 'resolved';

        // Map priority
        let priority = 'medium';
        if (priorityRaw === 'URGENT') priority = 'urgent';
        else if (priorityRaw === 'HIGH') priority = 'high';
        else if (priorityRaw === 'LOW') priority = 'low';

        // Map category
        let category = 'maintenance';
        if (categoryRaw?.toLowerCase().includes('it') || categoryRaw?.toLowerCase().includes('tech')) {
          category = 'technology';
        } else if (categoryRaw?.toLowerCase().includes('clean')) {
          category = 'cleaning';
        }

        // Parse assignees
        const assignees = assigneesRaw ? 
          assigneesRaw.replace(/[\[\]]/g, '').split(',').map(a => a.trim()).filter(Boolean) : 
          [];

        tickets.push({
          clickup_id: clickupId,
          subject,
          description: description || subject,
          status: ticketStatus,
          priority,
          category,
          requester_email: requesterEmail || '',
          requester_name: requesterName || '',
          room_number: location || '',
          assigned_to_name: assignees[0] || '',
          tags: ['clickup-import'],
          source: 'workflow'
        });
      }

      setParsedTickets(tickets);
      toast.success(`Parsed ${tickets.length} tickets`);
    } catch (error) {
      console.error("Parse error:", error);
      toast.error("Failed to parse data: " + error.message);
    }
  };

  const generateTicketNumber = async (existingNumbers) => {
    let maxNum = 0;
    existingNumbers.forEach(num => {
      const n = parseInt(num?.replace('TKT-', '') || '0');
      if (n > maxNum) maxNum = n;
    });
    return `TKT-${String(maxNum + 1).padStart(6, '0')}`;
  };

  const importTickets = async () => {
    if (parsedTickets.length === 0) {
      toast.error("No tickets to import");
      return;
    }

    setImporting(true);
    const results = { success: 0, skipped: 0, failed: 0 };

    try {
      // Get existing tickets to check for duplicates and get last ticket number
      const existingTickets = await base44.entities.Ticket.list();
      const existingSubjects = new Set(existingTickets.map(t => t.subject?.toLowerCase()));
      const existingNumbers = existingTickets.map(t => t.ticket_number);

      for (const ticket of parsedTickets) {
        // Skip duplicates
        if (existingSubjects.has(ticket.subject?.toLowerCase())) {
          results.skipped++;
          continue;
        }

        try {
          const ticketNumber = await generateTicketNumber(existingNumbers);
          existingNumbers.push(ticketNumber);

          await base44.entities.Ticket.create({
            ticket_number: ticketNumber,
            subject: ticket.subject,
            description: ticket.description,
            status: ticket.status,
            priority: ticket.priority,
            category: ticket.category,
            requester_email: ticket.requester_email,
            requester_name: ticket.requester_name,
            room_number: ticket.room_number,
            assigned_to_name: ticket.assigned_to_name,
            tags: ticket.tags,
            source: ticket.source,
            last_activity_at: new Date().toISOString()
          });

          existingSubjects.add(ticket.subject?.toLowerCase());
          results.success++;
        } catch (error) {
          console.error("Error creating ticket:", error);
          results.failed++;
        }
      }

      setImportResults(results);
      toast.success(`Imported ${results.success} tickets`);
      setParsedTickets([]);
      setRawData("");
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Import failed: " + error.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="h-full bg-gradient-to-br from-amber-50 to-orange-50 p-6 overflow-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to={createPageUrl('Ticketing')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl shadow-lg">
            <Upload className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Import Tickets</h1>
            <p className="text-slate-600">Paste ClickUp export data to import</p>
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
                    {importResults.success} imported, {importResults.skipped} skipped (duplicates), {importResults.failed} failed
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

        {/* Instructions */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="text-sm text-slate-600">
                <p className="font-medium text-slate-900 mb-1">How to use:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Copy your ClickUp ticket data (tab-separated format)</li>
                  <li>Paste it in the box below</li>
                  <li>Click "Parse Data" to preview</li>
                  <li>Click "Import" to create tickets</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Paste Area */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <Textarea
              placeholder="Paste your ClickUp ticket data here (tab-separated)..."
              value={rawData}
              onChange={(e) => setRawData(e.target.value)}
              className="min-h-[200px] font-mono text-xs"
            />
            <div className="flex gap-2">
              <Button onClick={parseClickUpData} variant="outline">
                <FileText className="w-4 h-4 mr-2" />
                Parse Data
              </Button>
              {parsedTickets.length > 0 && (
                <Button 
                  onClick={importTickets}
                  disabled={importing}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Import {parsedTickets.length} Tickets
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        {parsedTickets.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">Preview ({parsedTickets.length} tickets)</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {parsedTickets.map((ticket, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-lg border text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{ticket.subject}</span>
                      <Badge variant="outline">{ticket.status}</Badge>
                      <Badge variant="secondary">{ticket.priority}</Badge>
                      <Badge>{ticket.category}</Badge>
                    </div>
                    <div className="text-xs text-slate-500">
                      {ticket.requester_name && <span>From: {ticket.requester_name} • </span>}
                      {ticket.assigned_to_name && <span>Assigned: {ticket.assigned_to_name} • </span>}
                      {ticket.room_number && <span>Location: {ticket.room_number}</span>}
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