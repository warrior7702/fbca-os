import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Folder,
  FileText,
  FileImage,
  FileVideo,
  FileArchive,
  Download,
  ExternalLink,
  ArrowLeft,
  Loader2,
  FolderOpen,
  AlertCircle,
  File,
  FileSpreadsheet,
  FileCode,
  Music,
  Film
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion } from "framer-motion";
import { toast } from "sonner";
import ConnectionWarning from "@/components/shared/ConnectionWarning";

export default function Documents() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null); // Access user context to check for connection status
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentFolderId, setCurrentFolderId] = useState('root');
  const [breadcrumbs, setBreadcrumbs] = useState([{ id: 'root', name: 'OneDrive' }]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []); // Runs once on mount

  useEffect(() => {
    console.log('currentFolderId changed to:', currentFolderId);
    // Only attempt to load files if the user is connected
    if (user?.microsoft_access_token) {
      loadFiles(currentFolderId);
    } else {
      setLoading(false);
      setError(null); // Clear any previous API errors if not connected
      setItems([]); // Clear items if not connected
    }
  }, [currentFolderId, user?.microsoft_access_token]); // Re-run effect if connection status changes

  const loadFiles = async (folderId) => {
    setLoading(true);
    setError(null);
    console.log('loadFiles called with folderId:', folderId);
    try {
      const response = await base44.functions.invoke('getOneDriveFiles', { 
        folder_id: folderId 
      });
      console.log('OneDrive response:', response.data);
      setItems(response.data.items || []);
    } catch (error) {
      console.error('Failed to load files:', error);
      const errorMessage = error.response?.data?.error || error.message;
      setError(errorMessage);
      toast.error('Failed to load OneDrive files');
    } finally {
      setLoading(false);
    }
  };

  const openFolder = (folder) => {
    console.log('openFolder called with:', folder);
    setCurrentFolderId(folder.id);
    setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
  };

  const navigateToBreadcrumb = (index) => {
    const crumb = breadcrumbs[index];
    console.log('navigateToBreadcrumb called, going to:', crumb);
    setCurrentFolderId(crumb.id);
    setBreadcrumbs(prev => prev.slice(0, index + 1));
  };

  const getFileIcon = (name) => {
    const ext = name.split('.').pop().toLowerCase();
    if (ext.match(/jpg|jpeg|png|gif|svg|webp|bmp|tiff?/)) return FileImage;
    if (ext.match(/mp4|mov|avi|mkv|webm|flv|wmv/)) return Film;
    if (ext.match(/mp3|wav|flac|aac|ogg|wma/)) return Music;
    if (ext.match(/zip|rar|7z|tar|gz|bz2/)) return FileArchive;
    if (ext.match(/xlsx?|csv|xlsm/)) return FileSpreadsheet;
    if (ext.match(/docx?|txt|rtf/)) return FileText;
    if (ext.match(/pptx?|key/)) return File;
    if (ext.match(/js|jsx|ts|tsx|py|java|cpp|c|h|css|html|json|xml|yaml|yml/)) return FileCode;
    return FileText;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const openInNativeApp = (item) => {
    const ext = item.name.split('.').pop().toLowerCase();
    
    // Office files - open in Office Online (web apps) - no security issues
    if (ext.match(/docx?|dotx?|xlsx?|xltx?|csv|pptx?|potx?|ppsx?/)) {
      window.open(item.webUrl, '_blank');
      toast.info('Opening in Office Online...');
    } 
    // PDFs - open in browser (OneDrive has built-in viewer)
    else if (ext === 'pdf') {
      window.open(item.webUrl, '_blank');
      toast.info('Opening PDF...');
    }
    // Images - open in browser preview
    else if (ext.match(/jpg|jpeg|png|gif|bmp|svg|webp|tiff?/)) {
      window.open(item.webUrl, '_blank');
      toast.info('Opening image...');
    }
    // Everything else - open in browser
    else {
      window.open(item.webUrl, '_blank');
    }
  };

  const getFileColor = (name) => {
    const ext = name.split('.').pop().toLowerCase();
    if (ext.match(/jpg|jpeg|png|gif|svg|webp|bmp|tiff?/)) return { bg: 'bg-pink-100', text: 'text-pink-600' };
    if (ext.match(/mp4|mov|avi|mkv|webm|flv|wmv/)) return { bg: 'bg-purple-100', text: 'text-purple-600' };
    if (ext.match(/mp3|wav|flac|aac|ogg|wma/)) return { bg: 'bg-indigo-100', text: 'text-indigo-600' };
    if (ext.match(/zip|rar|7z|tar|gz|bz2/)) return { bg: 'bg-orange-100', text: 'text-orange-600' };
    if (ext.match(/xlsx?|csv|xlsm/)) return { bg: 'bg-green-100', text: 'text-green-600' };
    if (ext.match(/docx?|txt|rtf/)) return { bg: 'bg-blue-100', text: 'text-blue-600' };
    if (ext.match(/pptx?|key/)) return { bg: 'bg-red-100', text: 'text-red-600' };
    if (ext.match(/js|jsx|ts|tsx|py|java|cpp|c|h|css|html|json|xml|yaml|yml/)) return { bg: 'bg-slate-100', text: 'text-slate-600' };
    return { bg: 'bg-slate-100', text: 'text-slate-600' };
  };

  return (
    <div className="h-full bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-3 sm:p-6 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl('Dashboard'))}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="p-2 sm:p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl shadow-lg">
              <FolderOpen className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Documents</h1>
              <p className="text-sm text-slate-600">Browse your OneDrive files</p>
            </div>
          </div>
        </div>

        {/* Connection Warning */}
        {!user?.microsoft_access_token && (
          <div className="mb-6">
            <ConnectionWarning />
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
              {error.includes('not connected') && (
                <Button
                  variant="link"
                  className="ml-2 h-auto p-0 text-red-600 underline"
                  onClick={() => navigate(createPageUrl('Settings') + '?tab=integrations')}
                >
                  Connect Microsoft 365
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Only show breadcrumbs and file browser if connected */}
        {user?.microsoft_access_token && !error && (
          <div className="flex items-center gap-2 mb-6 px-4 py-3 bg-white rounded-lg shadow-sm border border-slate-200">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.id}>
                {index > 0 && <span className="text-slate-300 font-medium">/</span>}
                <button
                  onClick={() => navigateToBreadcrumb(index)}
                  className={`px-2 py-1 rounded-md transition-all text-sm font-medium ${
                    index === breadcrumbs.length - 1 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-slate-600 hover:bg-slate-100 hover:text-blue-600'
                  }`}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}

        {user?.microsoft_access_token && loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : user?.microsoft_access_token && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {items.map((item) => {
              const Icon = item.isFolder ? Folder : getFileIcon(item.name);
              const colors = item.isFolder ? { bg: 'bg-gradient-to-br from-blue-500 to-indigo-500', text: 'text-white' } : getFileColor(item.name);
              
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.03, y: -4 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <Card 
                    className="hover:shadow-xl transition-all cursor-pointer border-2 border-transparent hover:border-blue-200 overflow-hidden group"
                    onClick={() => {
                      if (item.isFolder) {
                        openFolder(item);
                      }
                    }}
                  >
                    <CardContent className="p-0">
                      <div className="flex flex-col">
                        {/* Icon Header */}
                        <div className={`${item.isFolder ? colors.bg : colors.bg} p-6 flex items-center justify-center`}>
                          <Icon className={`w-12 h-12 ${item.isFolder ? colors.text : colors.text} drop-shadow-lg`} />
                        </div>
                        
                        {/* File Info */}
                        <div className="p-3 bg-white">
                          <p className="font-semibold text-sm text-slate-900 truncate mb-1" title={item.name}>
                            {item.name}
                          </p>
                          {!item.isFolder && (
                            <p className="text-xs text-slate-500">
                              {formatFileSize(item.size)}
                            </p>
                          )}
                          
                          {/* Action Buttons */}
                          {!item.isFolder && (
                            <div className="flex gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="sm"
                                className="flex-1 text-xs h-8 bg-blue-600 hover:bg-blue-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openInNativeApp(item);
                                }}
                              >
                                <ExternalLink className="w-3 h-3 mr-1" />
                                Open
                              </Button>
                              {item.downloadUrl && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(item.downloadUrl, '_blank');
                                  }}
                                >
                                  <Download className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {user?.microsoft_access_token && items.length === 0 && !loading && !error && (
          <Card className="border-2 border-dashed border-slate-200">
            <CardContent className="p-12 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <FolderOpen className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">This folder is empty</h3>
              <p className="text-slate-500">No files or folders to display</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}