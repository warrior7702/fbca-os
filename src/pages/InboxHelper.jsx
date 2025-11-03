import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { 
  Mail, 
  Inbox, 
  Tag, 
  Clock, 
  AlertCircle,
  Loader2,
  ExternalLink,
  RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";
import EmailDetailModal from "../components/emails/EmailDetailModal";
import AppHeader from "../components/shared/AppHeader";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function InboxHelper() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [categorizedEmails, setCategorizedEmails] = useState({});
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [showEmailDetail, setShowEmailDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  useEffect(() => {
    loadUser();
    loadEmails();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const loadEmails = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('getCategorizedEmails');
      setCategorizedEmails(response.data.categorized || {});
    } catch (error) {
      console.error("Error loading emails:", error);
      toast.error("Failed to load emails");
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (importance) => {
    switch (importance) {
      case "high":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Mail className="w-4 h-4 text-blue-500" />;
    }
  };

  const allCategories = Object.keys(categorizedEmails);
  const filteredCategories = selectedCategory === "all" 
    ? allCategories 
    : allCategories.filter(cat => cat.toLowerCase().includes(selectedCategory.toLowerCase()));

  const filteredEmails = {};
  filteredCategories.forEach(category => {
    const emails = categorizedEmails[category] || [];
    const filtered = emails.filter(email => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        email.subject?.toLowerCase().includes(query) ||
        email.from?.toLowerCase().includes(query) ||
        email.fromName?.toLowerCase().includes(query) ||
        email.bodyPreview?.toLowerCase().includes(query)
      );
    });
    if (filtered.length > 0) {
      filteredEmails[category] = filtered;
    }
  });

  const totalEmails = Object.values(filteredEmails).reduce((sum, emails) => sum + emails.length, 0);

  return (
    <div className="h-full bg-gradient-to-br from-blue-50 to-cyan-50 overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <AppHeader
          icon={Inbox}
          title="Inbox Helper"
          description="View and manage categorized emails"
          iconColor="from-blue-500 to-cyan-500"
          action={
            <Button 
              onClick={loadEmails} 
              variant="outline"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          }
        />

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search emails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {allCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : Object.keys(filteredEmails).length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-20">
              <Inbox className="w-16 h-16 text-slate-300 mb-4" />
              <p className="text-slate-500 mb-2">No categorized emails found</p>
              <p className="text-sm text-slate-400">
                {searchQuery ? "Try a different search term" : "Categorize emails in your inbox to see them here"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(filteredEmails).map(([category, emails]) => (
              <Card key={category}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Tag className="w-5 h-5 text-blue-600" />
                      {category}
                      <Badge className="ml-2">{emails.length}</Badge>
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {emails.map((email, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="p-4 bg-white rounded-lg border border-slate-200 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="mt-1">
                            {getCategoryIcon(email.importance)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 
                                className="font-semibold text-slate-900 truncate cursor-pointer hover:text-blue-600"
                                onClick={() => {
                                  setSelectedEmail(email);
                                  setShowEmailDetail(true);
                                }}
                              >
                                {email.subject}
                              </h3>
                              {!email.isRead && (
                                <Badge variant="secondary" className="text-xs">New</Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-600 mb-1">
                              From: <span className="font-medium">{email.fromName || email.from}</span>
                            </p>
                            {email.bodyPreview && (
                              <p className="text-xs text-slate-500 line-clamp-2 mb-2">
                                {email.bodyPreview}
                              </p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              <Clock className="w-3 h-3" />
                              {format(new Date(email.receivedAt), 'MMM d, h:mm a')}
                              {email.hasAttachments && (
                                <>
                                  <span>•</span>
                                  <span>Has attachments</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(email.webLink, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Email Detail Modal */}
      {selectedEmail && (
        <EmailDetailModal
          email={selectedEmail}
          open={showEmailDetail}
          onClose={() => {
            setShowEmailDetail(false);
            setSelectedEmail(null);
          }}
        />
      )}
    </div>
  );
}