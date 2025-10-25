import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Search as SearchIcon,
  FileText,
  Folder,
  ArrowLeft,
  Loader2,
  Megaphone,
  UtensilsCrossed,
  User,
  Settings,
  LayoutDashboard,
  ExternalLink,
  Download,
  FileImage,
  FileVideo,
  FileArchive
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const appModules = [
  { name: "Dashboard", path: "Dashboard", icon: LayoutDashboard, description: "Your main hub", color: "text-blue-500" },
  { name: "Marketing", path: "Marketing", icon: Megaphone, description: "Campaign requests and assets", color: "text-purple-500" },
  { name: "Food Service", path: "FoodService", icon: UtensilsCrossed, description: "Catering orders and menu planning", color: "text-green-500" },
  { name: "FBCA Nexts", path: "FBCANexts", icon: User, description: "Your personal dashboard", color: "text-orange-500" },
  { name: "Settings", path: "Settings", icon: Settings, description: "Manage preferences and integrations", color: "text-slate-500" },
  { name: "Documents", path: "Documents", icon: Folder, description: "Browse OneDrive files", color: "text-blue-500" }
];

export default function Search() {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    if (q) {
      setQuery(q);
      performSearch(q);
    }
  }, [location.search]);

  const performSearch = async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 2) {
      setFiles([]);
      setModules([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);

    // Search modules
    const matchedModules = appModules.filter(module =>
      module.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      module.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setModules(matchedModules);

    // Search OneDrive files
    try {
      const response = await base44.functions.invoke('searchOneDrive', { query: searchQuery });
      setFiles(response.data.files || []);
    } catch (error) {
      console.error('Search error:', error);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    navigate(createPageUrl('Search') + `?q=${encodeURIComponent(query)}`);
  };

  const getFileIcon = (name) => {
    const ext = name.split('.').pop().toLowerCase();
    if (ext.match(/jpg|jpeg|png|gif|svg|webp/)) return FileImage;
    if (ext.match(/mp4|mov|avi|mkv/)) return FileVideo;
    if (ext.match(/zip|rar|7z|tar|gz/)) return FileArchive;
    return FileText;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const totalResults = modules.length + files.length;

  return (
    <div className="h-full bg-gradient-to-br from-blue-50 to-slate-50 p-6 overflow-auto">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl('Dashboard'))}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Search</h1>
            <p className="text-slate-600 text-sm">Search across files and modules</p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="mb-8">
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              type="text"
              placeholder="Search files, documents, and modules..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-12 h-14 text-lg"
              autoFocus
            />
          </div>
        </form>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}

        {!loading && hasSearched && (
          <div className="space-y-6">
            {totalResults > 0 && (
              <div className="text-sm text-slate-600">
                Found {totalResults} result{totalResults !== 1 ? 's' : ''} for "{query}"
              </div>
            )}

            {modules.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-3">Modules</h2>
                <div className="grid md:grid-cols-2 gap-3">
                  {modules.map((module) => (
                    <Link key={module.path} to={createPageUrl(module.path)}>
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ scale: 1.02 }}
                      >
                        <Card className="hover:shadow-lg transition-all cursor-pointer">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-slate-100 rounded-lg">
                                <module.icon className={`w-6 h-6 ${module.color}`} />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-slate-900">{module.name}</p>
                                <p className="text-sm text-slate-500">{module.description}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {files.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-slate-900 mb-3">Files</h2>
                <div className="space-y-2">
                  {files.map((file) => {
                    const Icon = file.isFolder ? Folder : getFileIcon(file.name);
                    return (
                      <motion.div
                        key={file.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <Card className="hover:shadow-md transition-all">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-slate-100 rounded-lg">
                                <Icon className="w-5 h-5 text-slate-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-slate-900 truncate">{file.name}</p>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                  {!file.isFolder && <span>{formatFileSize(file.size)}</span>}
                                  {file.path && <span>• {file.path}</span>}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.open(file.webUrl, '_blank')}
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </Button>
                                {!file.isFolder && file.downloadUrl && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => window.open(file.downloadUrl, '_blank')}
                                  >
                                    <Download className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {totalResults === 0 && (
              <div className="text-center py-20">
                <SearchIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No results found for "{query}"</p>
                <p className="text-sm text-slate-400 mt-2">Try searching with different keywords</p>
              </div>
            )}
          </div>
        )}

        {!hasSearched && !loading && (
          <div className="text-center py-20">
            <SearchIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">Start typing to search</p>
            <p className="text-sm text-slate-400 mt-2">Search across OneDrive files and app modules</p>
          </div>
        )}
      </div>
    </div>
  );
}