import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Calendar, Paperclip, ExternalLink, User } from "lucide-react";
import { format } from "date-fns";

export default function EmailDetailModal({ open, onOpenChange, email }) {
  if (!email) return null;

  const handleOpenInOutlook = () => {
    if (email.webLink) {
      window.open(email.webLink, '_blank', 'noopener,noreferrer');
    } else if (email.messageId) {
      window.open(
        `https://outlook.office.com/mail/search/id/${encodeURIComponent(email.messageId)}`,
        '_blank',
        'noopener,noreferrer'
      );
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
          <div className="flex gap-2 pt-4 border-t">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}