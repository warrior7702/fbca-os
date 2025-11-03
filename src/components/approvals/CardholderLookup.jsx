import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { User, Key, Loader2, X, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function CardholderLookup({ isOpen, onClose, onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Debounced search
  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (query.length >= 2) {
        performSearch(query);
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [query]);

  // Reset when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
    }
  }, [isOpen]);

  const performSearch = async (searchQuery) => {
    setSearching(true);
    
    console.log('🔍 CardholderLookup searching for:', searchQuery);

    try {
      const response = await base44.functions.invoke('cardholdersSearch', {
        q: searchQuery,
        limit: 12
      });

      console.log('📥 Search response:', response.data);

      if (response.data.ok) {
        setResults(response.data.results || []);
        console.log(`✅ Got ${response.data.results?.length || 0} results`);
      } else {
        console.error('❌ Search failed:', response.data.error);
        setResults([]);
      }
    } catch (error) {
      console.error('❌ Search error:', error);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelect = (cardholder) => {
    console.log('✅ Selected cardholder:', cardholder);
    onSelect(cardholder);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-600" />
            Search Door Codes
          </DialogTitle>
          <DialogDescription>
            Search by name or 6-digit door code to send to Planning Center
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by name or 6-digit door code..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 pr-10"
              autoFocus
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
            )}
            {query && !searching && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto">
            {query.length < 2 && (
              <div className="text-center py-8 text-slate-500">
                <Search className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-sm">Type at least 2 characters to search</p>
              </div>
            )}

            {query.length >= 2 && !searching && results.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                <p className="text-sm">No cardholders found for "{query}"</p>
              </div>
            )}

            {results.length > 0 && (
              <div className="space-y-2">
                {results.map((cardholder) => (
                  <motion.button
                    key={cardholder.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => handleSelect(cardholder)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-blue-50 rounded-lg transition-colors text-left border border-slate-200 hover:border-blue-300"
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-lg">{cardholder.name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-sm text-slate-600 flex items-center gap-1 font-mono font-semibold">
                          <Key className="w-4 h-4 text-blue-600" />
                          {cardholder.pin}#
                        </span>
                        {cardholder.member_id && (
                          <span className="text-sm text-slate-500">
                            • ID: {cardholder.member_id}
                          </span>
                        )}
                      </div>
                      {cardholder.email && (
                        <p className="text-sm text-slate-500 truncate mt-1">
                          {cardholder.email}
                        </p>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}