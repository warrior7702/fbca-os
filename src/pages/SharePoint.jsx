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
  const [siteFiles, setSiteFiles] = useState({});
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [categorizingSites, setCategorizingSites] = useState(false);

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
        
        // Auto-load files for first library
        if (response.data.libraries.length > 0) {
          loadLibraryFiles(site.id, response.data.libraries[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading libraries:', error);
      toast.error('Failed to load libraries');
    } finally {
      setLoadingSiteData({ ...loadingSiteData, [site.id]: false });
    }
  };

  const loadLibraryFiles = async (siteId, driveId) => {
    const key = `${siteId}_${driveId}`;
    if (siteFiles[key]) return;

    try {
      const response = await base44.functions.invoke('getSharePointFiles', {
        siteId,
        driveId
      });

      if (response.data.success) {
        setSiteFiles({ ...siteFiles, [key]: response.data.files });
      }
    } catch (error) {
      console.error('Error loading files:', error);
    }
  };

  const categorizeAllSites = async () => {
    if (!sites.length) return;
    
    setCategorizingSites(true);
    toast.info('AI is analyzing your sites...');
    
    try {
      const uncategorized = sites.filter(site => {
        const access = getSiteAccessData(site.id);
        return !access?.ai_category;
      });

      for (const site of uncategorized) {
        await base44.functions.invoke('categorizeSharePointSite', {
          siteId: site.id,
          siteName: site.displayName,
          siteUrl: site.webUrl
        });
      }

      // Reload site access data
      const accessData = await base44.entities.SharePointSiteAccess.filter({ 
        user_email: user.email 
      });
      setSiteAccess(accessData);
      
      toast.success('Sites categorized successfully!');
    } catch (error) {
      console.error('Error categorizing sites:', error);
      toast.error('Failed to categorize some sites');
    } finally {
      setCategorizingSites(false);
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

  const getAvailableCategories = () => {
    const categories = new Set();
    siteAccess.forEach(access => {
      if (access.ai_category) categories.add(access.ai_category);
    });
    return Array.from(categories).sort();
  };

  const getFilteredAndSortedSites = (sitesList) => {
    let filtered = sitesList;

    // Filter by category
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(site => {
        const access = getSiteAccessData(site.id);
        return access?.ai_category === categoryFilter;
      });
    }

    // Sort
    return filtered.sort((a, b) => {
      const accessA = getSiteAccessData(a.id);
      const accessB = getSiteAccessData(b.id);

      switch (sortBy) {
        case 'name':
          return a.displayName.localeCompare(b.displayName);
        case 'access':
          return (accessB?.access_count || 0) - (accessA?.access_count || 0);
        case 'recent':
          return new Date(accessB?.last_accessed || 0) - new Date(accessA?.last_accessed || 0);
        default:
          return 0;
      }
    });
  };

  const getFileIcon = (file) => {
    if (file.folder) return <FolderOpen className="w-4 h-4 text-blue-500" />;
    
    const name = file.name.toLowerCase();
    if (name.match(/\.(jpg|jpeg|png|gif|bmp)$/)) return <Image className="w-4 h-4 text-green-500" />;
    if (name.match(/\.(mp4|mov|avi|wmv)$/)) return <Video className="w-4 h-4 text-purple-500" />;
    if (name.match(/\.(mp3|wav|m4a)$/)) return <Music className="w-4 h-4 text-pink-500" />;
    return <FileText className="w-4 h-4 text-slate-500" />;
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

        <Tabs defaultValue="my-sites" className="mb-6">
          <TabsList className="grid w-full grid-cols-3 max-w-2xl">
            <TabsTrigger value="my-sites">
              <Star className="w-4 h-4 mr-2" />
              My Sites
            </TabsTrigger>
            <TabsTrigger value="browse">
              <Library className="w-4 h-4 mr-2" />
              Browse All
            </TabsTrigger>
            <TabsTrigger value="search">
              <Search className="w-4 h-4 mr-2" />
              Search
            </TabsTrigger>
          </TabsList>

          {/* My Sites Tab */}
          <TabsContent value="my-sites" className="space-y-6 mt-6">
            <AppHeader
              icon={Star}
              title="My Sites"
              description={`${favoritedSites.length + frequentSites.length} sites you use regularly`}
              iconColor="from-yellow-500 to-orange-500"
            />

            {/* Favorited Sites */}
            {favoritedSites.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-400" />
                    Favorites
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2">
                    {favoritedSites.map(site => {
                      const accessData = getSiteAccessData(site.id);
                      return (
                        <Card key={site.id} className="border-2 border-yellow-200 bg-yellow-50/30 hover:shadow-lg transition-all">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between gap-4 mb-3">
                              <div className="flex items-center gap-3 flex-1">
                                <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center">
                                  <Library className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                  <p className="font-semibold text-slate-900">{site.displayName}</p>
                                  <p className="text-xs text-slate-500">
                                    {accessData?.access_count || 0} visits • Last {accessData?.last_accessed ? format(new Date(accessData.last_accessed), 'MMM d') : 'never'}
                                  </p>
                                </div>
                              </div>
                              <button onClick={() => toggleSiteFavorite(site)}>
                                <Star className="w-5 h-5 fill-yellow-400 text-yellow-400 hover:scale-110 transition-transform" />
                              </button>
                            </div>
                            <Button
                              size="sm"
                              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                              onClick={() => loadSiteLibraries(site)}
                              disabled={loadingSiteData[site.id]}
                            >
                              {loadingSiteData[site.id] ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : expandedSite === site.id ? (
                                'Hide Folders'
                              ) : (
                                'View Folders'
                              )}
                            </Button>

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
                                    className="flex items-center justify-between p-3 bg-white rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                                    onClick={() => window.open(library.webUrl, '_blank')}
                                  >
                                    <div className="flex items-center gap-2">
                                      <FolderOpen className="w-5 h-5 text-blue-500" />
                                      <span className="text-sm font-medium">{library.name}</span>
                                    </div>
                                    <ExternalLink className="w-4 h-4 text-slate-400" />
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
            ) : (
              <Card className="border-2 border-dashed border-slate-200">
                <CardContent className="p-8 text-center">
                  <Star className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="font-semibold text-slate-900 mb-1">No favorites yet</h3>
                  <p className="text-sm text-slate-500">Click the star icon on any site to add it here</p>
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
                  <div className="grid gap-3 md:grid-cols-2">
                    {frequentSites.map(site => {
                      const accessData = getSiteAccessData(site.id);
                      return (
                        <Card key={site.id} className="hover:shadow-lg transition-all">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between gap-4 mb-3">
                              <div className="flex items-center gap-3 flex-1">
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
                                  <Library className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                  <p className="font-semibold text-slate-900">{site.displayName}</p>
                                  <p className="text-xs text-slate-500">
                                    {accessData?.access_count || 0} visits
                                  </p>
                                </div>
                              </div>
                              <button onClick={() => toggleSiteFavorite(site)}>
                                <Star className={`w-5 h-5 hover:scale-110 transition-transform ${accessData?.is_favorited ? 'fill-yellow-400 text-yellow-400' : 'text-slate-400'}`} />
                              </button>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full"
                              onClick={() => loadSiteLibraries(site)}
                              disabled={loadingSiteData[site.id]}
                            >
                              {loadingSiteData[site.id] ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : expandedSite === site.id ? (
                                'Hide Folders'
                              ) : (
                                'View Folders'
                              )}
                            </Button>

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
                                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                                    onClick={() => window.open(library.webUrl, '_blank')}
                                  >
                                    <div className="flex items-center gap-2">
                                      <FolderOpen className="w-5 h-5 text-blue-500" />
                                      <span className="text-sm font-medium">{library.name}</span>
                                    </div>
                                    <ExternalLink className="w-4 h-4 text-slate-400" />
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
          </TabsContent>

          {/* Browse All Tab */}
          <TabsContent value="browse" className="space-y-6 mt-6">
            <AppHeader
              icon={Library}
              title="Browse All Sites"
              description={`${sites.length} SharePoint sites available`}
              iconColor="from-blue-500 to-indigo-500"
            />

            {otherSites.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <Library className="w-5 h-5 text-slate-600" />
                    All Sites
                  </CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      onClick={categorizeAllSites}
                      disabled={categorizingSites}
                      variant="outline"
                    >
                      {categorizingSites ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          AI Categorizing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          AI Categorize
                        </>
                      )}
                    </Button>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                      <SelectTrigger className="w-44">
                        <SelectValue placeholder="Filter by category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {getAvailableCategories().map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="access">Most Used</SelectItem>
                        <SelectItem value="recent">Recent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {getFilteredAndSortedSites(otherSites).map(site => {
                  const accessData = getSiteAccessData(site.id);
                  return (
                    <Card key={site.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Library className="w-6 h-6 text-slate-500" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{site.displayName}</p>
                              {accessData?.ai_category && (
                                <Badge variant="outline" className="text-xs mt-1">
                                  {accessData.ai_category}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <button onClick={() => toggleSiteFavorite(site)}>
                            <Star className="w-4 h-4 text-slate-400" />
                          </button>
                        </div>

                        {accessData?.ai_description && (
                          <p className="text-xs text-slate-600 mb-2 line-clamp-2">
                            {accessData.ai_description}
                          </p>
                        )}

                        {accessData?.ai_tags && accessData.ai_tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {accessData.ai_tags.slice(0, 3).map((tag, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => loadSiteLibraries(site)}
                          disabled={loadingSiteData[site.id]}
                        >
                          {loadingSiteData[site.id] ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <>View Content</>
                          )}
                        </Button>

                        {/* Expanded Libraries with Files */}
                        {expandedSite === site.id && siteLibraries[site.id] && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-3 pt-3 border-t space-y-3"
                          >
                            {siteLibraries[site.id].map(library => {
                              const fileKey = `${site.id}_${library.id}`;
                              const files = siteFiles[fileKey] || [];
                              
                              return (
                                <div key={library.id} className="space-y-2">
                                  <div className="flex items-center justify-between p-2 bg-slate-100 rounded">
                                    <div className="flex items-center gap-2">
                                      <FolderOpen className="w-4 h-4 text-blue-600" />
                                      <span className="text-xs font-semibold">{library.name}</span>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => loadLibraryFiles(site.id, library.id)}
                                    >
                                      {files.length > 0 ? (
                                        <ExternalLink className="w-3 h-3" />
                                      ) : (
                                        'Load'
                                      )}
                                    </Button>
                                  </div>

                                  {files.length > 0 && (
                                    <div className="pl-4 space-y-1">
                                      {files.slice(0, 5).map(file => (
                                        <div
                                          key={file.id}
                                          className="flex items-center justify-between p-2 bg-white rounded hover:bg-slate-50 cursor-pointer"
                                          onClick={() => window.open(file.webUrl, '_blank')}
                                        >
                                          <div className="flex items-center gap-2 flex-1 min-w-0">
                                            {getFileIcon(file)}
                                            <span className="text-xs truncate">{file.name}</span>
                                          </div>
                                          <ExternalLink className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                        </div>
                                      ))}
                                      {files.length > 5 && (
                                        <p className="text-xs text-slate-500 text-center py-1">
                                          +{files.length - 5} more files
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
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
          </TabsContent>

          {/* Search Tab */}
          <TabsContent value="search" className="space-y-6 mt-6">
            <AppHeader
              icon={Search}
              title="Search SharePoint"
              description="Search across all sites and files"
              iconColor="from-purple-500 to-pink-500"
            />

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      placeholder="Search files, folders, and content..."
                      value={globalSearchQuery}
                      onChange={(e) => setGlobalSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleGlobalSearch()}
                      className="pl-11 h-14 text-lg"
                    />
                  </div>
                  <Button
                    onClick={handleGlobalSearch}
                    disabled={searching || !globalSearchQuery.trim()}
                    className="h-14 px-8 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="w-5 h-5 text-purple-600" />
                    Results ({searchResults.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {searchResults.map(file => (
                      <Card key={file.id} className="hover:shadow-lg transition-all cursor-pointer" onClick={() => window.open(file.webUrl, '_blank')}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3 mb-3">
                            {getFileIcon(file)}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate mb-1">{file.name}</p>
                              {file.size && (
                                <p className="text-xs text-slate-500">
                                  {(file.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                          >
                            <ExternalLink className="w-3 h-3 mr-2" />
                            Open File
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {searchResults.length === 0 && globalSearchQuery && !searching && (
              <Card className="border-2 border-dashed border-slate-200">
                <CardContent className="p-12 text-center">
                  <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="font-semibold text-slate-900 mb-1">No results found</h3>
                  <p className="text-sm text-slate-500">Try different keywords or check your spelling</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}