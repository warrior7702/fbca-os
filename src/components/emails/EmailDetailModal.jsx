import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Calendar, Paperclip, ExternalLink, User, FileText, CheckSquare, Loader2, Sparkles, Flag, Archive } from "lucide-react";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner"; // Assuming sonner is used for toasts, add this import

export default function EmailDetailModal({ open, onOpenChange, email, onEmailUpdated }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [removingFlag, setRemovingFlag] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    if (open && email?.bodyPreview) {
      // Reset analysis when modal opens with a new email or body
      setAnalysis(null); 
      analyzeEmail();
    }
  }, [open, email]);

  const analyzeEmail = async () => {
    if (!email?.bodyPreview) return;
    
    setAnalyzing(true);
    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this email and extract:
1. Action items (things that need to be done)
2. Important dates or deadlines mentioned
3. Key people mentioned

Email content:
Subject: ${email.subject}
From: ${email.fromName || email.from}
Body: ${email.bodyPreview}

Be concise and specific.`,
        response_json_schema: {
          type: "object",
          properties: {
            action_items: {
              type: "array",
              items: { type: "string" },
              description: "List of action items or tasks mentioned"
            },
            dates: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  date: { type: "string" },
                  context: { type: "string" }
                }
              },
              description: "Important dates with context"
            },
            people: {
              type: "array",
              items: { type: "string" },
              description: "Key people mentioned"
            }
          }
        }
      });

      setAnalysis(response);
    } catch (error) {
      console.error('Failed to analyze email:', error);
      toast.error('Failed to analyze email. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  if (!email) return null;

  const handleRemoveFlag = async () => {
    if (!email?.messageId) {
      toast.error('Cannot remove flag - no message ID');
      return;
    }
    
    setRemovingFlag(true);
    try {
      const response = await base44.functions.invoke('removeEmailFlag', {
        messageId: email.messageId
      });
      
      if (response.data.success) {
        toast.success('Flag removed');
        onOpenChange(false);
        if (onEmailUpdated) onEmailUpdated();
      } else {
        throw new Error(response.data.error || 'Failed to remove flag');
      }
    } catch (error) {
      console.error('Remove flag error:', error);
      toast.error('Failed to remove flag: ' + (error.message || 'Unknown error'));
    } finally {
      setRemovingFlag(false);
    }
  };

  const handleArchive = async () => {
    if (!email?.messageId) {
      toast.error('Cannot archive - no message ID');
      return;
    }
    
    setArchiving(true);
    try {
      const response = await base44.functions.invoke('archiveEmail', {
        messageId: email.messageId
      });
      
      if (response.data.success) {
        toast.success('Email archived');
        onOpenChange(false);
        if (onEmailUpdated) onEmailUpdated();
      } else {
        throw new Error(response.data.error || 'Failed to archive');
      }
    } catch (error) {
      console.error('Archive error:', error);
      toast.error('Failed to archive: ' + (error.message || 'Unknown error'));
    } finally {
      setArchiving(false);
    }
  };

  const handleOpenInOutlook = () => {
    if (!email) return;

    if (email.webLink) {
      // Format: ms-outlook:ofv|u|{webUrl}
      const desktopProtocol = `ms-outlook:ofv|u|${email.webLink}`;
      
      // Try desktop first by creating an invisible iframe
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = desktopProtocol;
      document.body.appendChild(iframe);
      
      // Fallback to web after 500ms if desktop doesn't open
      // Remove iframe after attempting to open desktop app
      setTimeout(() => {
        document.body.removeChild(iframe);
        // If user is still here and desktop app didn't launch, open in browser as fallback
        // This is a heuristic; if the desktop app opens, the browser might not necessarily open if the user clicks "cancel" on the prompt.
        // But if the desktop app isn't installed or the protocol isn't handled, this provides a seamless fallback.
        window.open(email.webLink, '_blank', 'noopener,noreferrer');
      }, 500);
      
      toast.info('Attempting to open in Outlook desktop app, falling back to web if unsuccessful...');
    } else if (email.messageId) {
      // Fallback if no webLink but messageId is available
      window.open(
        `https://outlook.office.com/mail/search/id/${encodeURIComponent(email.messageId)}`,
        '_blank',
        'noopener,noreferrer'
      );
      toast.info('Opening in Outlook Web...');
    } else {
      toast.error('Could not find a link to open this email in Outlook.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            Email Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Subject */}
          <div>
            <label className="text-sm font-medium text-slate-500">Subject</label>
            <h3 className="text-lg font-semibold text-slate-900 mt-1">
              {email.subject || '(No Subject)'}
            </h3>
          </div>

          {/* From */}
          <div>
            <label className="text-sm font-medium text-slate-500 flex items-center gap-1">
              <User className="w-3 h-3" />
              From
            </label>
            <p className="text-slate-900 mt-1">
              {email.fromName || email.from}
              {email.fromName && email.from && (
                <span className="text-sm text-slate-500 ml-2">
                  &lt;{email.from}&gt;
                </span>
              )}
            </p>
          </div>

          {/* Received */}
          {email.receivedAt && (
            <div>
              <label className="text-sm font-medium text-slate-500 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Received
              </label>
              <p className="text-slate-900 mt-1">
                {format(new Date(email.receivedAt), 'PPpp')}
              </p>
            </div>
          )}

          {/* Email Preview/Summary */}
          <div>
            <label className="text-sm font-medium text-slate-500 flex items-center gap-1">
              <FileText className="w-3 h-3" />
              Preview
            </label>
            {email.bodyPreview ? (
              <div className="mt-1 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                  {email.bodyPreview}
                </p>
              </div>
            ) : (
              <div className="mt-1 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-sm text-slate-500 italic">
                  No preview available. Open in Outlook to view full content.
                </p>
              </div>
            )}
          </div>

          {/* AI Analysis */}
          {email.bodyPreview && (
            <div className="border-t pt-4">
              {analyzing ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600 mr-2" />
                  <span className="text-sm text-slate-600">Analyzing email...</span>
                </div>
              ) : analysis ? (
                <div className="space-y-3 p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 text-blue-700 font-semibold mb-3">
                    <Sparkles className="w-4 h-4" />
                    AI Analysis
                  </div>

                  {/* Action Items */}
                  {analysis.action_items && analysis.action_items.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                        <CheckSquare className="w-3 h-3 text-blue-600" />
                        Action Items
                      </p>
                      <ul className="space-y-1">
                        {analysis.action_items.map((item, idx) => (
                          <li key={idx} className="text-sm text-slate-600 pl-4 flex items-start gap-2">
                            <span className="text-blue-500 mt-1">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Important Dates */}
                  {analysis.dates && analysis.dates.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-purple-600" />
                        Important Dates
                      </p>
                      <ul className="space-y-1">
                        {analysis.dates.map((dateInfo, idx) => (
                          <li key={idx} className="text-sm text-slate-600 pl-4 flex items-start gap-2">
                            <span className="text-purple-500 mt-1">•</span>
                            <span><strong>{dateInfo.date}</strong> - {dateInfo.context}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* People Mentioned */}
                  {analysis.people && analysis.people.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                        <User className="w-3 h-3 text-green-600" />
                        People Mentioned
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {analysis.people.map((person, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {person}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* No insights */}
                  {(!analysis.action_items || analysis.action_items.length === 0) &&
                   (!analysis.dates || analysis.dates.length === 0) &&
                   (!analysis.people || analysis.people.length === 0) && (
                    <p className="text-sm text-slate-500 italic">
                      No specific action items, dates, or key people detected.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* Categories */}
          {email.categories && email.categories.length > 0 && (
            <div>
              <label className="text-sm font-medium text-slate-500">Categories</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {email.categories.map((cat, idx) => (
                  <Badge key={idx} variant="secondary">
                    {cat}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          {email.hasAttachments && (
            <div>
              <label className="text-sm font-medium text-slate-500 flex items-center gap-1">
                <Paperclip className="w-3 h-3" />
                Has Attachments
              </label>
              <p className="text-sm text-slate-600 mt-1">
                This email contains attachments. Open in Outlook to view them.
              </p>
            </div>
          )}

          {/* Importance */}
          {email.importance && email.importance !== 'normal' && (
            <div>
              <Badge variant={email.importance === 'high' ? 'destructive' : 'outline'}>
                {email.importance === 'high' ? 'High Priority' : 'Low Priority'}
              </Badge>
            </div>
          )}

          {/* Read Status */}
          <div>
            <Badge variant={email.isRead ? 'secondary' : 'default'}>
              {email.isRead ? 'Read' : 'Unread'}
            </Badge>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-4 border-t">
            <div className="flex gap-2">
              <Button
                onClick={handleOpenInOutlook}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in Outlook
              </Button>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleRemoveFlag}
                disabled={removingFlag}
                className="flex-1 text-orange-600 border-orange-300 hover:bg-orange-50"
              >
                {removingFlag ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Flag className="w-4 h-4 mr-2" />
                )}
                Remove Flag
              </Button>
              <Button
                variant="outline"
                onClick={handleArchive}
                disabled={archiving}
                className="flex-1 text-slate-600 border-slate-300 hover:bg-slate-50"
              >
                {archiving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Archive className="w-4 h-4 mr-2" />
                )}
                Archive
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}