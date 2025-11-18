import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FolderOpen,
  FileText,
  Image,
  Video,
  Music,
  Upload,
  Search,
  Loader2,
  Sparkles,
  Download,
  ExternalLink,
  Library,
  List,
  Plus,
  Settings
} from "lucide-react";
import AppHeader from "../components/shared/AppHeader";
import ConnectionWarning from "../components/shared/ConnectionWarning";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { motion } from "framer-motion";

const MINISTRY_COLORS = {
  'Youth': 'bg-purple-100 text-purple-700',
  'Worship': 'bg-blue-100 text-blue-700',
  'Pastoral': 'bg-green-100 text-green-700',
  'Children': 'bg-yellow-100 text-yellow-700',
  'Outreach': 'bg-orange-100 text-orange-700',
  'Events': 'bg-pink-100 text-pink-700',
  'Admin': 'bg-slate-100 text-slate-700',
  'Facilities': 'bg-indigo-100 text-indigo-700'
};

export default function SharePointPage() {
  const [sites, setSites] = useState([]);
  const [libraries, setLibraries] = useState([]);
  const [files, setFiles] = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [selectedLibrary, setSelectedLibrary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingLibraries, setLoadingLibraries] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [aiTagging, setAiTagging] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [activeTab, setActiveTab] = useState('libraries');
  const [lists, setLists] = useState([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [showCreateListModal, setShowCreateListModal] = useState(false);
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);
  const [selectedList, setSelectedList] = useState(null);
  const [newListData, setNewListData] = useState({ displayName: '', description: '', template: 'genericList' });
  const [newColumnData, setNewColumnData] = useState({ columnName: '', columnType: 'text', required: false, description: '' });
  const [creatingList, setCreatingList] = useState(false);
  const [addingColumn, setAddingColumn] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (!currentUser) {
        toast.error('Please sign in');
        return;
      }

      const response = await base44.functions.invoke('getSharePointSites');
      console.log('SharePoint response:', response.data);
      
      if (response.data.success) {
        setSites(response.data.sites);
        toast.success(`Loaded ${response.data.sites.length} SharePoint sites`);
      } else {
        toast.error(response.data.error || 'Failed to load SharePoint sites');
      }
    } catch (error) {
      console.error('Error loading SharePoint:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to load SharePoint sites';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const loadLibraries = async (site) => {
    setLoadingLibraries(true);
    setSelectedSite(site);
    setSelectedLibrary(null);
    setFiles([]);
    
    try {
      const response = await base44.functions.invoke('getSharePointLibraries', {
        siteId: site.id
      });
      
      if (response.data.success) {
        setLibraries(response.data.libraries);
      }
    } catch (error) {
      console.error('Error loading libraries:', error);
      toast.error('Failed to load document libraries');
    } finally {
      setLoadingLibraries(false);
    }
  };

  const loadLists = async (site) => {
    setLoadingLists(true);
    setSelectedSite(site);
    
    try {
      const response = await base44.functions.invoke('getSharePointLists', {
        siteId: site.id
      });
      
      if (response.data.success) {
        setLists(response.data.lists);
      }
    } catch (error) {
      console.error('Error loading lists:', error);
      toast.error('Failed to load SharePoint lists');
    } finally {
      setLoadingLists(false);
    }
  };

  const handleCreateList = async () => {
    if (!newListData.displayName.trim()) {
      toast.error('List name is required');
      return;
    }

    setCreatingList(true);
    try {
      const response = await base44.functions.invoke('createSharePointList', {
        siteId: selectedSite.id,
        displayName: newListData.displayName,
        description: newListData.description,
        template: newListData.template
      });

      if (response.data.success) {
        toast.success('List created successfully!');
        setShowCreateListModal(false);
        setNewListData({ displayName: '', description: '', template: 'genericList' });
        loadLists(selectedSite);
      }
    } catch (error) {
      console.error('Error creating list:', error);
      toast.error('Failed to create list');
    } finally {
      setCreatingList(false);
    }
  };

  const handleAddColumn = async () => {
    if (!newColumnData.columnName.trim()) {
      toast.error('Column name is required');
      return;
    }

    setAddingColumn(true);
    try {
      const response = await base44.functions.invoke('addSharePointColumn', {
        siteId: selectedSite.id,
        listId: selectedList.id,
        columnName: newColumnData.columnName,
        columnType: newColumnData.columnType,
        required: newColumnData.required,
        description: newColumnData.description
      });

      if (response.data.success) {
        toast.success('Column added successfully!');
        setShowAddColumnModal(false);
        setNewColumnData({ columnName: '', columnType: 'text', required: false, description: '' });
        loadLists(selectedSite);
      }
    } catch (error) {
      console.error('Error adding column:', error);
      toast.error('Failed to add column');
    } finally {
      setAddingColumn(false);
    }
  };

  const loadFiles = async (library) => {
    setLoadingFiles(true);
    setSelectedLibrary(library);
    
    try {
      const response = await base44.functions.invoke('getSharePointFiles', {
        siteId: selectedSite.id,
        driveId: library.id
      });
      
      if (response.data.success) {
        setFiles(response.data.files);
      }
    } catch (error) {
      console.error('Error loading files:', error);
      toast.error('Failed to load files');
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !selectedSite || !selectedLibrary) {
      toast.error('Please select a file and library');
      return;
    }

    setUploading(true);
    try {
      // First upload to Base44
      const uploadResponse = await base44.integrations.Core.UploadFile({
        file: uploadFile
      });

      // Then upload to SharePoint
      const spResponse = await base44.functions.invoke('uploadToSharePoint', {
        siteId: selectedSite.id,
        driveId: selectedLibrary.id,
        fileName: uploadFile.name,
        fileUrl: uploadResponse.file_url
      });

      if (spResponse.data.success) {
        toast.success('File uploaded successfully!');
        setShowUploadModal(false);
        setUploadFile(null);
        setAiSuggestions(null);
        loadFiles(selectedLibrary);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleAITag = async () => {
    if (!uploadFile) return;

    setAiTagging(true);
    try {
      const uploadResponse = await base44.integrations.Core.UploadFile({
        file: uploadFile
      });

      const response = await base44.functions.invoke('tagMediaWithAI', {
        fileName: uploadFile.name,
        fileUrl: uploadResponse.file_url,
        fileType: uploadFile.type
      });

      if (response.data.success) {
        setAiSuggestions(response.data.suggestions);
        toast.success('AI suggestions generated!');
      }
    } catch (error) {
      console.error('AI tagging error:', error);
      toast.error('Failed to generate AI tags');
    } finally {
      setAiTagging(false);
    }
  };

  const getFileIcon = (file) => {
    if (file.folder) return <FolderOpen className="w-8 h-8 text-blue-500" />;
    
    const name = file.name.toLowerCase();
    if (name.match(/\.(jpg|jpeg|png|gif|bmp)$/)) return <Image className="w-8 h-8 text-green-500" />;
    if (name.match(/\.(mp4|mov|avi|wmv)$/)) return <Video className="w-8 h-8 text-purple-500" />;
    if (name.match(/\.(mp3|wav|m4a)$/)) return <Music className="w-8 h-8 text-pink-500" />;
    return <FileText className="w-8 h-8 text-slate-500" />;
  };

  const filteredFiles = files.filter(file => 
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-blue-50 to-indigo-50 overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {!user?.microsoft_access_token && <ConnectionWarning />}

        {sites.length === 0 && !loading && (
          <Card className="border-2 border-yellow-200 bg-yellow-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold">!</span>
                </div>
                <div>
                  <h3 className="font-semibold text-yellow-900 mb-2">No SharePoint Sites Found</h3>
                  <p className="text-sm text-yellow-800 mb-3">
                    Your account needs access to SharePoint Online. Please check:
                  </p>
                  <ul className="text-sm text-yellow-800 space-y-1 ml-4">
                    <li>• You have a Microsoft 365 subscription with SharePoint Online</li>
                    <li>• Your account has been granted access to SharePoint sites</li>
                    <li>• Microsoft SSO is properly configured in Settings</li>
                  </ul>
                  <p className="text-xs text-yellow-700 mt-3">
                    Check the browser console (F12) for detailed error messages.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <AppHeader
          icon={Library}
          title="SharePoint Media Hub"
          description="Smart media archive and document management"
          iconColor="from-blue-500 to-indigo-500"
          action={
            selectedLibrary && (
              <Button
                onClick={() => setShowUploadModal(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload
              </Button>
            )
          }
        />

        <div className="grid grid-cols-12 gap-6">
          {/* Sites Sidebar */}
          <div className="col-span-3 space-y-3">
            <h3 className="font-semibold text-slate-900">SharePoint Sites</h3>
            <div className="space-y-2">
              {sites.map(site => (
                <button
                  key={site.id}
                  onClick={() => loadLibraries(site)}
                  className={`w-full p-3 rounded-lg text-left transition-all ${
                    selectedSite?.id === site.id
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  <p className="font-medium truncate">{site.displayName}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="col-span-9 space-y-4">
            {!selectedSite ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Library className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    Select a SharePoint Site
                  </h3>
                  <p className="text-slate-600">
                    Choose a site from the sidebar to view document libraries and lists
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="libraries" onClick={() => loadLibraries(selectedSite)}>
                    <FolderOpen className="w-4 h-4 mr-2" />
                    Libraries
                  </TabsTrigger>
                  <TabsTrigger value="lists" onClick={() => loadLists(selectedSite)}>
                    <List className="w-4 h-4 mr-2" />
                    Lists
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="libraries" className="mt-4">
                  {!selectedLibrary ? (
              <div>
                <h3 className="font-semibold text-slate-900 mb-4">
                  Document Libraries in {selectedSite.displayName}
                </h3>
                {loadingLibraries ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {libraries.map(library => (
                      <motion.div
                        key={library.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <Card 
                          className="cursor-pointer hover:shadow-lg transition-shadow"
                          onClick={() => loadFiles(library)}
                        >
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                              <FolderOpen className="w-5 h-5 text-blue-600" />
                              {library.name}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-slate-600">
                              {library.description || 'No description'}
                            </p>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    placeholder="Search files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-11"
                  />
                </div>

                {/* Files Grid */}
                {loadingFiles ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                  </div>
                ) : filteredFiles.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-600">No files found</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-3">
                    {filteredFiles.map(file => (
                      <motion.div
                        key={file.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                      >
                        <Card className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              {getFileIcon(file)}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {file.name}
                                </p>
                                {file.size && (
                                  <p className="text-xs text-slate-500">
                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                  </p>
                                )}
                                {file.lastModifiedDateTime && (
                                  <p className="text-xs text-slate-400">
                                    {format(new Date(file.lastModifiedDateTime), 'MMM d, yyyy')}
                                  </p>
                                )}
                              </div>
                            </div>
                            {file.webUrl && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full mt-3"
                                onClick={() => window.open(file.webUrl, '_blank')}
                              >
                                <ExternalLink className="w-3 h-3 mr-2" />
                                Open
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}
                </TabsContent>

                <TabsContent value="lists" className="mt-4">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-slate-900">
                        SharePoint Lists in {selectedSite.displayName}
                      </h3>
                      <Button
                        onClick={() => setShowCreateListModal(true)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create List
                      </Button>
                    </div>

                    {loadingLists ? (
                      <div className="text-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                      </div>
                    ) : lists.length === 0 ? (
                      <Card>
                        <CardContent className="p-12 text-center">
                          <List className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                          <p className="text-slate-600">No lists found in this site</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-4">
                        {lists.map(list => (
                          <motion.div
                            key={list.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                          >
                            <Card>
                              <CardHeader>
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <CardTitle className="flex items-center gap-2">
                                      <List className="w-5 h-5 text-blue-600" />
                                      {list.displayName}
                                    </CardTitle>
                                    {list.description && (
                                      <p className="text-sm text-slate-600 mt-1">{list.description}</p>
                                    )}
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedList(list);
                                      setShowAddColumnModal(true);
                                    }}
                                  >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Column
                                  </Button>
                                </div>
                              </CardHeader>
                              <CardContent>
                                {list.columns && list.columns.length > 0 && (
                                  <div>
                                    <p className="text-xs font-semibold text-slate-600 mb-2">Columns:</p>
                                    <div className="flex flex-wrap gap-2">
                                      {list.columns.map((col, idx) => (
                                        <Badge key={idx} variant="secondary" className="text-xs">
                                          {col.displayName}
                                          {col.required && <span className="text-red-500 ml-1">*</span>}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {list.webUrl && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="mt-3"
                                    onClick={() => window.open(list.webUrl, '_blank')}
                                  >
                                    <ExternalLink className="w-3 h-3 mr-2" />
                                    Open in SharePoint
                                  </Button>
                                )}
                              </CardContent>
                            </Card>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>

        {/* Create List Modal */}
        <Dialog open={showCreateListModal} onOpenChange={setShowCreateListModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New SharePoint List</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">List Name *</label>
                <Input
                  placeholder="e.g., Projects, Tasks, Contacts"
                  value={newListData.displayName}
                  onChange={(e) => setNewListData({...newListData, displayName: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Input
                  placeholder="Brief description of this list"
                  value={newListData.description}
                  onChange={(e) => setNewListData({...newListData, description: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Template</label>
                <select
                  className="w-full p-2 border rounded"
                  value={newListData.template}
                  onChange={(e) => setNewListData({...newListData, template: e.target.value})}
                >
                  <option value="genericList">Generic List</option>
                  <option value="documentLibrary">Document Library</option>
                  <option value="events">Events</option>
                  <option value="tasks">Tasks</option>
                  <option value="contacts">Contacts</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowCreateListModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateList}
                  disabled={creatingList}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {creatingList ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create List'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Column Modal */}
        <Dialog open={showAddColumnModal} onOpenChange={setShowAddColumnModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Column to {selectedList?.displayName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Column Name *</label>
                <Input
                  placeholder="e.g., Status, Due Date, Priority"
                  value={newColumnData.columnName}
                  onChange={(e) => setNewColumnData({...newColumnData, columnName: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Column Type</label>
                <select
                  className="w-full p-2 border rounded"
                  value={newColumnData.columnType}
                  onChange={(e) => setNewColumnData({...newColumnData, columnType: e.target.value})}
                >
                  <option value="text">Single Line of Text</option>
                  <option value="number">Number</option>
                  <option value="boolean">Yes/No</option>
                  <option value="dateTime">Date & Time</option>
                  <option value="choice">Choice (dropdown)</option>
                  <option value="multiChoice">Multiple Choice</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Input
                  placeholder="Optional column description"
                  value={newColumnData.description}
                  onChange={(e) => setNewColumnData({...newColumnData, description: e.target.value})}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newColumnData.required}
                  onChange={(e) => setNewColumnData({...newColumnData, required: e.target.checked})}
                />
                <label className="text-sm">Required field</label>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAddColumnModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAddColumn}
                  disabled={addingColumn}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {addingColumn ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add Column'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Upload Modal */}
        <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Upload to {selectedLibrary?.name}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <Input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0])}
                  className="max-w-md mx-auto"
                />
                {uploadFile && (
                  <p className="text-sm text-slate-600 mt-2">
                    Selected: {uploadFile.name}
                  </p>
                )}
              </div>

              {uploadFile && (
                <Button
                  onClick={handleAITag}
                  disabled={aiTagging}
                  variant="outline"
                  className="w-full"
                >
                  {aiTagging ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Get AI Tagging Suggestions
                    </>
                  )}
                </Button>
              )}

              {aiSuggestions && (
                <Card className="border-2 border-blue-200 bg-blue-50">
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      <p className="font-semibold text-blue-900">AI Suggestions</p>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-slate-600">Ministry</p>
                        <Badge className={MINISTRY_COLORS[aiSuggestions.ministry] || 'bg-slate-100'}>
                          {aiSuggestions.ministry}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600">Content Type</p>
                        <Badge variant="outline">{aiSuggestions.content_type}</Badge>
                      </div>
                      {aiSuggestions.tags?.length > 0 && (
                        <div>
                          <p className="text-xs text-slate-600 mb-1">Tags</p>
                          <div className="flex flex-wrap gap-1">
                            {aiSuggestions.tags.map((tag, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      <p className="text-sm text-slate-700">{aiSuggestions.description}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowUploadModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={!uploadFile || uploading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    'Upload to SharePoint'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}