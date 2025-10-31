import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Search, User, Key, Mail, Hash } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function CardholderLookup({ onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (query.length >= 2) {
        searchCardholders(query);
      } else {
        setResults([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchCardholders = async (q) => {
    setLoading(true);
    setShowResults(true);
    try {
      const response = await base44.functions.invoke('cardholdersSearch', { q, limit: 10 });
      setResults(response.data.results || []);
    } catch (error) {
      console.error('Cardholder search error:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (cardholder) => {
    setQuery(cardholder.name);
    setShowResults(false);
    onSelect(cardholder);
  };

  const highlightMatch = (text, query) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() ? 
        <mark key={i} className="bg-yellow-200 font-semibold">{part}</mark> : part
    );
  };

  return (
    <div ref={searchRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          type="text"
          placeholder="Search by name or door code..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          className="pl-10 pr-10"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
        )}
      </div>

      <AnimatePresence>
        {showResults && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-2 bg-white rounded-lg shadow-xl border border-slate-200 max-h-96 overflow-y-auto"
          >
            {results.map((cardholder) => (
              <button
                key={cardholder.id}
                onClick={() => handleSelect(cardholder)}
                className="w-full text-left p-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">
                      {highlightMatch(cardholder.name, query)}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <Key className="w-3 h-3" />
                        {highlightMatch(cardholder.pin, query)}
                      </span>
                      {cardholder.member_id && (
                        <span className="flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          {cardholder.member_id}
                        </span>
                      )}
                      {cardholder.email && (
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3" />
                          {cardholder.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {showResults && query.length >= 2 && results.length === 0 && !loading && (
        <Card className="absolute z-50 w-full mt-2">
          <CardContent className="p-4 text-center text-slate-500 text-sm">
            No cardholders found for "{query}"
          </CardContent>
        </Card>
      )}
    </div>
  );
}