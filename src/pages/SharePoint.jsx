import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Settings,
  Star,
  Clock,
  Filter
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
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [siteAccess, setSiteAccess] = useState([]);
  const [loadingSiteData, setLoadingSiteData] = useState({});
  const [expandedSite, setExpandedSite] = useState(null);
  const [siteLibraries, setSiteLibraries] = useState({});
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

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

      const [sitesResponse, accessData] = await Promise.all([
        base44.functions.invoke('getSharePointSites'),
        base44.entities.SharePointSiteAccess.filter({ user_email: currentUser.email })
      ]);
      
      if (sitesResponse.data.success) {
        setSites(sitesResponse.data.sites);
        setSiteAccess(accessData);
      } else {
        toast.error(sitesResponse.data.error || 'Failed to load SharePoint sites');
      }
    } catch (error) {
      console.error('Error loading SharePoint:', error);
      toast.error('Failed to load SharePoint');
    } finally {
      setLoading(false);
    }
  };

  const trackSiteAccess = async (site) => {
    if (!user) return;

    const existing = siteAccess.find(s => s.site_id === site.id);

    try {
      if (existing) {
        const updated = await base44.entities.SharePointSiteAccess.update(existing.id, {
          access_count: existing.access_count + 1,
          last_accessed: new Date().toISOString()
        });
        setSiteAccess(siteAccess.map(s => s.id === existing.id ? updated : s));
      } else {
        const newAccess = await base44.entities.SharePointSiteAccess.create({
          user_email: user.email,
          site_id: site.id,
          site_name: site.displayName,
          site_url: site.webUrl,
          access_count: 1,
          is_favorited: false,
          last_accessed: new Date().toISOString()
        });
        setSiteAccess([...siteAccess, newAccess]);
      }
    } catch (error) {
      console.error('Error tracking site access:', error);
    }
  };

  const toggleSiteFavorite = async (site) => {
    if (!user) return;

    const existing = siteAccess.find(s => s.site_id === site.id);

    try {
      if (existing) {
        const updated = await base44.entities.SharePointSiteAccess.update(existing.id, {
          is_favorited: !existing.is_favorited
        });
        setSiteAccess(siteAccess.map(s => s.id === existing.id ? updated : s));
        toast.success(updated.is_favorited ? 'Added to favorites' : 'Removed from favorites');
      } else {
        const newAccess = await base44.entities.SharePointSiteAccess.create({
          user_email: user.email,
          site_id: site.id,
          site_name: site.displayName,
          site_url: site.webUrl,
          access_count: 0,
          is_favorited: true,
          last_accessed: new Date().toISOString()
        });
        setSiteAccess([...siteAccess, newAccess]);
        toast.success('Added to favorites');
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorite');
    }
  };

  const loadSiteLibraries = async (site) => {
    if (siteLibraries[site.id]) {
      setExpandedSite(expandedSite === site.id ? null : site.id);
      return;
    }

    setLoadingSiteData({ ...loadingSiteData, [site.id]: true });
    await trackSiteAccess(site);

    try {
      const response = await base44.functions.invoke('getSharePointLibraries', {
        siteId: site.id
      });

      if (response.data.success) {
        setSiteLibraries({ ...siteLibraries, [site.id]: response.data.libraries });
        setExpandedSite(site.id);
      }
    } catch (error) {
      console.error('Error loading libraries:', error);
      toast.error('Failed to load libraries');
    } finally {
      setLoadingSiteData({ ...loadingSiteData, [site.id]: false });
    }
  };

  const handleGlobalSearch = async () => {
    if (!globalSearchQuery.trim()) return;

    setSearching(true);
    try {
      const response = await base44.functions.invoke('searchSharePointFiles', {
        searchQuery: globalSearchQuery
      });

      if (response.data.success) {
        setSearchResults(response.data.results);
      }
    } catch (error) {
      console.error('Error searching:', error);
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const getSiteAccessData = (siteId) => {
    return siteAccess.find(s => s.site_id === siteId);
  };

  const favoritedSites = sites.filter(site => {
    const access = getSiteAccessData(site.id);
    return access?.is_favorited;
  });

  const frequentSites = sites
    .filter(site => {
      const access = getSiteAccessData(site.id);
      return access && access.access_count > 0 && !access.is_favorited;
    })
    .sort((a, b) => {
      const accessA = getSiteAccessData(a.id);
      const accessB = getSiteAccessData(b.id);
      return (accessB?.access_count || 0) - (accessA?.access_count || 0);
    })
    .slice(0, 5);

  const otherSites = sites.filter(site => {
    const access = getSiteAccessData(site.id);
    return !access?.is_favorited && (!access || access.access_count === 0);
  });

  const getFileIcon = (file) => {
    if (file.folder) return <FolderOpen className="w-8 h-8 text-blue-500" />;
    
    const name = file.name.toLowerCase();
    if (name.match(/\.(jpg|jpeg|png|gif|bmp)$/)) return <Image className="w-8 h-8 text-green-500" />;
    if (name.match(/\.(mp4|mov|avi|wmv)$/)) return <Video className="w-8 h-8 text-purple-500" />;
    if (name.match(/\.(mp3|wav|m4a)$/)) return <Music className="w-8 h-8 text-pink-500" />;
    return <FileText className="w-8 h-8 text-slate-500" />;
  };

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
          title="SharePoint"
          description="Quick access to your sites and shared folders"
          iconColor="from-blue-500 to-indigo-500"
        />

        {/* Global Search */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  placeholder="Search across all SharePoint sites..."
                  value={globalSearchQuery}
                  onChange={(e) => setGlobalSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleGlobalSearch()}
                  className="pl-11 h-12"
                />
              </div>
              <Button
                onClick={handleGlobalSearch}
                disabled={searching || !globalSearchQuery.trim()}
                className="h-12"
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Search Results ({searchResults.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {searchResults.map(file => (
                  <Card key={file.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {getFileIcon(file)}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{file.name}</p>
                          {file.size && (
                            <p className="text-xs text-slate-500">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
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
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Favorited Sites */}
        {favoritedSites.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500" />
                Your Favorite Sites
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {favoritedSites.map(site => {
                  const accessData = getSiteAccessData(site.id);
                  return (
                    <Card key={site.id} className="border-2 border-yellow-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1">
                            <Library className="w-8 h-8 text-yellow-600" />
                            <div>
                              <p className="font-semibold">{site.displayName}</p>
                              <p className="text-xs text-slate-500">
                                Accessed {accessData?.access_count || 0} times
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => loadSiteLibraries(site)}
                              disabled={loadingSiteData[site.id]}
                            >
                              {loadingSiteData[site.id] ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : expandedSite === site.id ? (
                                'Hide'
                              ) : (
                                'View Folders'
                              )}
                            </Button>
                            <button onClick={() => toggleSiteFavorite(site)}>
                              <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                            </button>
                          </div>
                        </div>

                        {/* Expanded Libraries */}
                        {expandedSite === site.id && siteLibraries[site.id] && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-4 pt-4 border-t space-y-2"
                          >
                            {siteLibraries[site.id].map(library => (
                              <div
                                key={library.id}
                                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <FolderOpen className="w-5 h-5 text-blue-500" />
                                  <span className="text-sm font-medium">{library.name}</span>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => window.open(library.webUrl, '_blank')}
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          )}

          {/* Frequently Visited Sites */}
          {frequentSites.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Frequently Visited
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {frequentSites.map(site => {
                  const accessData = getSiteAccessData(site.id);
                  return (
                    <Card key={site.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1">
                            <Library className="w-8 h-8 text-blue-600" />
                            <div>
                              <p className="font-semibold">{site.displayName}</p>
                              <p className="text-xs text-slate-500">
                                Accessed {accessData?.access_count || 0} times
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => loadSiteLibraries(site)}
                              disabled={loadingSiteData[site.id]}
                            >
                              {loadingSiteData[site.id] ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : expandedSite === site.id ? (
                                'Hide'
                              ) : (
                                'View Folders'
                              )}
                            </Button>
                            <button onClick={() => toggleSiteFavorite(site)}>
                              <Star
                                className={`w-5 h-5 ${
                                  accessData?.is_favorited
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'text-slate-400'
                                }`}
                              />
                            </button>
                          </div>
                        </div>

                        {/* Expanded Libraries */}
                        {expandedSite === site.id && siteLibraries[site.id] && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-4 pt-4 border-t space-y-2"
                          >
                            {siteLibraries[site.id].map(library => (
                              <div
                                key={library.id}
                                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <FolderOpen className="w-5 h-5 text-blue-500" />
                                  <span className="text-sm font-medium">{library.name}</span>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => window.open(library.webUrl, '_blank')}
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          )}

          {/* All Other Sites */}
          {otherSites.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Library className="w-5 h-5 text-slate-600" />
                All Sites
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {otherSites.map(site => (
                  <Card key={site.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Library className="w-6 h-6 text-slate-500" />
                          <p className="font-medium text-sm truncate">{site.displayName}</p>
                        </div>
                        <button onClick={() => toggleSiteFavorite(site)}>
                          <Star className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-3"
                        onClick={() => loadSiteLibraries(site)}
                        disabled={loadingSiteData[site.id]}
                      >
                        {loadingSiteData[site.id] ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <>View Folders</>
                        )}
                      </Button>

                      {/* Expanded Libraries */}
                      {expandedSite === site.id && siteLibraries[site.id] && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-3 pt-3 border-t space-y-2"
                        >
                          {siteLibraries[site.id].map(library => (
                            <div
                              key={library.id}
                              className="flex items-center justify-between p-2 bg-slate-50 rounded hover:bg-slate-100"
                            >
                              <div className="flex items-center gap-2">
                                <FolderOpen className="w-4 h-4 text-blue-500" />
                                <span className="text-xs">{library.name}</span>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => window.open(library.webUrl, '_blank')}
                              >
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Removed modals - no longer needed */}
        <Dialog open={false}>
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

        <Dialog open={false}>
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

        <Dialog open={false}>
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