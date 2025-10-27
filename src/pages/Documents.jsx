
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
  AlertCircle
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

  return (
    <div className="h-full bg-gradient-to-br from-blue-50 to-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl('Dashboard'))}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <FolderOpen className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-slate-900">Documents</h1>
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
          <div className="flex items-center gap-2 mb-4 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.id}>
                {index > 0 && <span className="text-slate-400">/</span>}
                <button
                  onClick={() => navigateToBreadcrumb(index)}
                  className={`hover:text-blue-600 transition-colors ${
                    index === breadcrumbs.length - 1 ? 'text-blue-600 font-medium' : 'text-slate-600'
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
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {items.map((item) => {
              const Icon = item.isFolder ? Folder : getFileIcon(item.name);
              
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.05 }}
                >
                  <Card 
                    className="hover:shadow-lg transition-all cursor-pointer"
                    onClick={() => {
                      if (item.isFolder) {
                        openFolder(item);
                      }
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-col items-center text-center gap-3">
                        <div className={`p-3 rounded-xl ${
                          item.isFolder ? 'bg-blue-100' : 'bg-slate-100'
                        }`}>
                          <Icon className={`w-8 h-8 ${
                            item.isFolder ? 'text-blue-600' : 'text-slate-600'
                          }`} />
                        </div>
                        <div className="w-full">
                          <p className="font-medium text-sm text-slate-900 truncate">
                            {item.name}
                          </p>
                          {!item.isFolder && (
                            <p className="text-xs text-slate-500 mt-1">
                              {formatFileSize(item.size)}
                            </p>
                          )}
                        </div>
                        {!item.isFolder && (
                          <div className="flex gap-1 w-full">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-xs"
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
                                className="flex-1 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(item.downloadUrl, '_blank');
                                }}
                              >
                                <Download className="w-3 h-3 mr-1" />
                                Save
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {user?.microsoft_access_token && items.length === 0 && !loading && !error && (
          <div className="text-center py-20">
            <FolderOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">This folder is empty</p>
          </div>
        )}
      </div>
    </div>
  );
}
