import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, User, Key, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function CardholderLookup({ onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (query.length >= 2) {
        performSearch(query);
      } else {
        setResults([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [query]);

  const performSearch = async (searchQuery) => {
    setSearching(true);
    setShowResults(true);
    
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
    setQuery("");
    setShowResults(false);
    setResults([]);
  };

  return (
    <div ref={searchRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          type="text"
          placeholder="Search by name or 6-digit door code..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          className="pl-10 pr-4"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
        )}
      </div>

      {/* Results Dropdown */}
      <AnimatePresence>
        {showResults && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-2 bg-white rounded-lg shadow-xl border border-slate-200 max-h-96 overflow-y-auto"
          >
            {results.length === 0 && !searching && (
              <div className="p-4 text-center text-sm text-slate-500">
                No cardholders found for "{query}"
              </div>
            )}

            {results.length > 0 && (
              <div className="p-2">
                {results.map((cardholder) => (
                  <button
                    key={cardholder.id}
                    onClick={() => handleSelect(cardholder)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-blue-50 rounded-lg transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900">{cardholder.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-600 flex items-center gap-1">
                          <Key className="w-3 h-3" />
                          {cardholder.pin}#
                        </span>
                        {cardholder.member_id && (
                          <span className="text-xs text-slate-500">
                            • ID: {cardholder.member_id}
                          </span>
                        )}
                      </div>
                      {cardholder.email && (
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {cardholder.email}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}