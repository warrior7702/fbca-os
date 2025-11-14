import React, { useState, useRef, useEffect } from "react";
import { Search, Loader2, Sparkles, Calendar, Ticket, ListChecks, User, Folder } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function AISearchBar({ onBookingRequest, onTicketRequest, onTaskRequest }) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [interpreting, setInterpreting] = useState(false);
  const [results, setResults] = useState({ staff: [], files: [], modules: [] });
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
        setAiSuggestion(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (query.length >= 2) {
        performSearch(query);
      } else {
        setResults({ staff: [], files: [], modules: [] });
        setAiSuggestion(null);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [query]);

  const performSearch = async (searchQuery) => {
    setSearching(true);
    setInterpreting(true);

    try {
      const lowerQuery = searchQuery.toLowerCase();

      // Parallel: Regular search + AI interpretation
      const [staffResult, filesResult, aiResult] = await Promise.all([
        base44.entities.StaffContact.filter({}).catch(() => []),
        base44.functions.invoke('searchOneDrive', { query: searchQuery }).catch(() => ({ data: { files: [] } })),
        base44.functions.invoke('aiCommandInterpreter', { query: searchQuery }).catch(() => null)
      ]);

      // Process staff results
      const staff = (staffResult || [])
        .filter(person =>
          person.full_name?.toLowerCase().includes(lowerQuery) ||
          person.email?.toLowerCase().includes(lowerQuery)
        )
        .slice(0, 5);

      // Process file results
      const files = (filesResult.data?.files || []).slice(0, 5);

      // Module search
      const modules = [
        { name: "Tasks", path: "MyTasks", icon: ListChecks },
        { name: "Approvals", path: "MyApprovals", icon: Calendar },
        { name: "Meetings", path: "MyMeetings", icon: Calendar },
        { name: "Support Tickets", path: "Ticketing", icon: Ticket }
      ].filter(m => m.name.toLowerCase().includes(lowerQuery)).slice(0, 3);

      setResults({ staff, files, modules });

      // Handle AI interpretation
      if (aiResult?.data?.success && aiResult.data.interpretation) {
        const interp = aiResult.data.interpretation;
        
        if (interp.intent !== 'search' && interp.intent !== 'unclear' && interp.confidence > 0.6) {
          setAiSuggestion({
            ...interp,
            person: aiResult.data.person
          });
        }
      }

      setShowResults(true);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
      setInterpreting(false);
    }
  };

  const handleAIAction = () => {
    if (!aiSuggestion) return;

    const intent = aiSuggestion.intent;
    const params = aiSuggestion.parameters || {};

    if (intent === 'book_meeting') {
      if (aiSuggestion.person) {
        onBookingRequest?.(aiSuggestion.person, params);
        toast.success(`Opening booking for ${aiSuggestion.person.displayName}`);
      } else {
        toast.error('Could not find that person');
      }
    } else if (intent === 'create_ticket') {
      onTicketRequest?.(params);
      toast.success('Opening ticket creation');
    } else if (intent === 'create_task') {
      onTaskRequest?.(params);
      toast.success('Opening task creation');
    }

    setQuery('');
    setShowResults(false);
    setAiSuggestion(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (aiSuggestion && aiSuggestion.intent !== 'search') {
      handleAIAction();
    } else if (query.trim()) {
      navigate(createPageUrl('Search') + `?q=${encodeURIComponent(query)}`);
      setQuery('');
      setShowResults(false);
    }
  };

  const totalResults = results.staff.length + results.files.length + results.modules.length;

  return (
    <div className="flex-1 max-w-md mx-2 md:mx-8 relative" ref={searchRef}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 z-10" />
          <input
            type="text"
            placeholder="Search or ask AI..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-9 pl-10 pr-10 bg-white/5 hover:bg-white/10 focus:bg-white/10 border border-white/10 rounded-lg text-white placeholder-white/40 text-sm outline-none transition-colors relative z-10"
          />
          {(searching || interpreting) && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 animate-spin z-10" />
          )}
          {aiSuggestion && !interpreting && (
            <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-yellow-400 z-10 animate-pulse" />
          )}
        </div>
      </form>

      {showResults && (query.length >= 2) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-12 left-0 right-0 bg-white rounded-lg shadow-2xl border border-slate-200 max-h-96 overflow-y-auto z-50"
        >
          {/* AI Suggestion */}
          {aiSuggestion && (
            <div className="p-3 border-b border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-purple-600 mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-purple-900 mb-1">AI Suggestion</p>
                  <p className="text-sm text-slate-700">{aiSuggestion.suggested_action}</p>
                  <Button
                    onClick={handleAIAction}
                    size="sm"
                    className="mt-2 bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {aiSuggestion.intent === 'book_meeting' && 'Book Meeting'}
                    {aiSuggestion.intent === 'create_ticket' && 'Create Ticket'}
                    {aiSuggestion.intent === 'create_task' && 'Create Task'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Staff Results */}
          {results.staff.length > 0 && (
            <div className="p-2">
              <div className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase">
                People ({results.staff.length})
              </div>
              {results.staff.map((person) => (
                <button
                  key={person.id}
                  onClick={() => {
                    navigate(createPageUrl('StaffDirectory') + `?name=${encodeURIComponent(person.full_name)}`);
                    setQuery('');
                    setShowResults(false);
                  }}
                  className="w-full flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-semibold">
                      {person.first_name?.[0]}{person.last_name?.[0]}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{person.full_name}</p>
                    <p className="text-xs text-slate-500 truncate">{person.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Module Results */}
          {results.modules.length > 0 && (
            <div className="p-2 border-t border-slate-100">
              <div className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase">
                Apps ({results.modules.length})
              </div>
              {results.modules.map((module) => (
                <button
                  key={module.path}
                  onClick={() => {
                    navigate(createPageUrl(module.path));
                    setQuery('');
                    setShowResults(false);
                  }}
                  className="w-full flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors text-left"
                >
                  <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <module.icon className="w-4 h-4 text-slate-600" />
                  </div>
                  <p className="text-sm font-medium text-slate-900">{module.name}</p>
                </button>
              ))}
            </div>
          )}

          {/* File Results */}
          {results.files.length > 0 && (
            <div className="p-2 border-t border-slate-100">
              <div className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase">
                Files ({results.files.length})
              </div>
              {results.files.map((file) => (
                <button
                  key={file.id}
                  onClick={() => {
                    window.open(file.webUrl, '_blank');
                    setQuery('');
                    setShowResults(false);
                  }}
                  className="w-full flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors text-left"
                >
                  <Folder className="w-4 h-4 flex-shrink-0 text-blue-500" />
                  <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                </button>
              ))}
            </div>
          )}

          {totalResults > 0 && (
            <div className="p-2 border-t border-slate-100">
              <button
                onClick={() => {
                  navigate(createPageUrl('Search') + `?q=${encodeURIComponent(query)}`);
                  setShowResults(false);
                  setQuery('');
                }}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium py-2"
              >
                View all results
              </button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}