import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
  Play,
  Pause,
  Radio,
  Mic2,
  Headphones,
  Music,
  Film,
  ArrowLeft,
  Calendar,
  ExternalLink,
  Loader2,
  Volume2,
  ChevronRight,
  Clock,
  Sparkles,
  RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";

export default function MediaPlayer() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const section = searchParams.get('section') || 'home';
  
  const [loading, setLoading] = useState(true);
  const [media, setMedia] = useState({ sermons: [], videos: [], podcasts: [], livestream: null });
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    loadMediaData();
    const liveCheckInterval = setInterval(checkLiveStatus, 120000);
    return () => clearInterval(liveCheckInterval);
  }, []);

  const checkLiveStatus = async () => {
    try {
      const response = await base44.functions.invoke('getUnifiedMedia');
      if (response.data?.media?.livestream) {
        setIsLive(response.data.media.livestream.isLive);
      }
    } catch (error) {
      console.error('Error checking live status:', error);
    }
  };

  const loadMediaData = async () => {
    console.log('🎬 Loading unified media...');
    setLoading(true);
    
    try {
      const response = await base44.functions.invoke('getUnifiedMedia');
      console.log('📊 Media response:', response.data);
      
      if (response.data?.success) {
        setMedia(response.data.media);
        setIsLive(response.data.media.livestream?.isLive || false);
        toast.success('Media loaded!');
      } else {
        toast.error('Failed to load media');
      }
    } catch (error) {
      console.error('Error loading media:', error);
      toast.error('Failed to load media content');
    } finally {
      setLoading(false);
    }
  };

  const sections = [
    {
      id: 'livestream',
      title: 'Live Stream',
      icon: Radio,
      color: 'from-red-500 to-pink-500',
      description: 'Watch live now',
      badge: isLive ? 'LIVE' : null,
      badgeAnimate: isLive
    },
    {
      id: 'sermons',
      title: 'Sermons',
      icon: Mic2,
      color: 'from-blue-500 to-indigo-500',
      description: `${media.sermons.length} messages`,
      count: media.sermons.length
    },
    {
      id: 'videos',
      title: 'Videos',
      icon: Film,
      color: 'from-green-500 to-emerald-500',
      description: `${media.videos.length} videos`,
      count: media.videos.length
    },
    {
      id: 'podcasts',
      title: 'Podcasts',
      icon: Headphones,
      color: 'from-purple-500 to-pink-500',
      description: `${media.podcasts.length} shows`,
      count: media.podcasts.length
    }
  ];

  const renderHome = () => {
    const featured = media.sermons[0] || media.videos[0];

    return (
      <div className="space-y-6">
        {/* Hero - Featured Content */}
        {featured && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl shadow-2xl"
          >
            <div className="relative aspect-video">
              <img
                src={featured.thumbnail}
                alt={featured.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
              <div className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-end">
                <div className="flex items-center gap-2 mb-3">
                  <Badge className="bg-red-600 text-white border-0">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse mr-2" />
                    LATEST
                  </Badge>
                </div>
                <h2 className="text-2xl sm:text-4xl font-bold text-white mb-2 drop-shadow-lg">
                  {featured.title}
                </h2>
                {featured.date && (
                  <p className="text-white/90 mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {featured.date}
                  </p>
                )}
                <div className="flex gap-3">
                  <Button
                    onClick={() => window.open(featured.videoUrl, '_blank')}
                    size="lg"
                    className="bg-white text-slate-900 hover:bg-white/90 shadow-xl"
                  >
                    <Play className="w-5 h-5 mr-2 fill-current" />
                    Watch Now
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Quick Access Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {sections.map((section, idx) => (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card
                className="cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all group border-2 border-transparent hover:border-blue-200"
                onClick={() => navigate(createPageUrl('MediaPlayer') + `?section=${section.id}`)}
              >
                <CardContent className="p-4 sm:p-6 text-center">
                  <div className={`w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-3 bg-gradient-to-br ${section.color} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg`}>
                    <section.icon className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-1 text-sm">{section.title}</h3>
                  <p className="text-xs text-slate-500">{section.description}</p>
                  {section.badge && (
                    <Badge className={`mt-2 text-xs ${section.badgeAnimate ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-red-100 text-red-700'}`}>
                      {section.badge}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Latest Sermons Row */}
        {media.sermons.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Mic2 className="w-5 h-5 text-blue-600" />
                Latest Sermons
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(createPageUrl('MediaPlayer') + '?section=sermons')}
              >
                View All <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                {media.sermons.slice(0, 3).map((sermon) => (
                  <motion.div
                    key={sermon.id}
                    whileHover={{ scale: 1.03 }}
                    className="cursor-pointer"
                    onClick={() => window.open(sermon.videoUrl, '_blank')}
                  >
                    <Card className="overflow-hidden border-2 border-transparent hover:border-blue-300 transition-all">
                      {sermon.thumbnail && (
                        <div className="relative">
                          <img
                            src={sermon.thumbnail}
                            alt={sermon.title}
                            className="w-full h-40 object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                          <Badge className="absolute top-2 left-2 bg-blue-600 text-white">
                            Sermon
                          </Badge>
                          {sermon.date && (
                            <div className="absolute bottom-2 left-2 right-2">
                              <p className="text-xs text-white/90">{sermon.date}</p>
                            </div>
                          )}
                        </div>
                      )}
                      <CardContent className="p-3">
                        <h3 className="font-semibold text-sm line-clamp-2">{sermon.title}</h3>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Featured Podcasts */}
        {media.podcasts.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Headphones className="w-5 h-5 text-purple-600" />
                Podcasts
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(createPageUrl('MediaPlayer') + '?section=podcasts')}
              >
                View All <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {media.podcasts.slice(0, 2).map((podcast) => (
                  <motion.div
                    key={podcast.id}
                    whileHover={{ scale: 1.02 }}
                    className="cursor-pointer"
                    onClick={() => window.open(podcast.feedUrl, '_blank')}
                  >
                    <Card className="border-2 border-transparent hover:border-purple-300 transition-all">
                      <div className="flex gap-4 p-4">
                        <img
                          src={podcast.thumbnail}
                          alt={podcast.title}
                          className="w-24 h-24 rounded-lg object-cover shadow-md"
                        />
                        <div className="flex-1">
                          <Badge className="bg-purple-100 text-purple-700 mb-2 text-xs">Podcast</Badge>
                          <h3 className="font-semibold text-slate-900 mb-1">{podcast.title}</h3>
                          <p className="text-sm text-slate-600 line-clamp-2 mb-2">{podcast.description}</p>
                          <Button size="sm" variant="outline">
                            <Play className="w-3 h-3 mr-1 fill-current" />
                            Listen
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderLiveStream = () => (
    <div className="space-y-6">
      <Card className="overflow-hidden shadow-2xl">
        <div className="bg-gradient-to-br from-red-600 to-pink-600 p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            {isLive && (
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [1, 0.5, 1]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="w-3 h-3 bg-white rounded-full"
              />
            )}
            {!isLive && <div className="w-3 h-3 bg-white/50 rounded-full" />}
            <h2 className="text-2xl font-bold">{isLive ? 'Live Now' : 'Live Stream'}</h2>
          </div>
          <p className="text-white/90">
            {isLive ? 'Service is currently live!' : 'Watch FBCA services live'}
          </p>
        </div>
        
        <div className="relative aspect-video bg-slate-900">
          <iframe
            src={media.livestream?.embedUrl || 'https://www.fbca.org/watch-listen/live/'}
            className="w-full h-full"
            frameBorder="0"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            title="FBCA Live Stream"
          />
        </div>
        
        <CardContent className="p-6 bg-slate-50">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">Service Times</h3>
              <div className="text-sm text-slate-600 space-y-1">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>Sundays: {media.livestream?.schedule?.sunday_morning_1}, {media.livestream?.schedule?.sunday_morning_2}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>Wednesdays: {media.livestream?.schedule?.wednesday_evening}</span>
                </div>
              </div>
            </div>
            <Button
              onClick={() => window.open(media.livestream?.url || 'https://www.fbca.org/watch-listen/live/', '_blank')}
              variant="outline"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Full Page
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderSermons = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardTitle className="flex items-center gap-2 mb-2">
            <Mic2 className="w-6 h-6 text-blue-600" />
            Sermons & Messages
          </CardTitle>
          <p className="text-sm text-slate-600">{media.sermons.length} sermons available</p>
        </CardHeader>
        <CardContent className="p-6">
          {media.sermons.length === 0 ? (
            <div className="text-center py-12">
              <Mic2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No Sermons Found</h3>
              <p className="text-slate-600">Check back soon for new content</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {media.sermons.map((sermon, idx) => (
                <motion.div
                  key={sermon.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  whileHover={{ scale: 1.03 }}
                  className="cursor-pointer"
                  onClick={() => window.open(sermon.videoUrl, '_blank')}
                >
                  <Card className="overflow-hidden border-2 border-transparent hover:border-blue-300 hover:shadow-xl transition-all">
                    {sermon.thumbnail && (
                      <div className="relative">
                        <img
                          src={sermon.thumbnail}
                          alt={sermon.title}
                          className="w-full h-48 object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                        <Badge className="absolute top-3 left-3 bg-blue-600 text-white">Sermon</Badge>
                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                          {sermon.date && (
                            <div className="flex items-center text-white text-sm gap-1">
                              <Calendar className="w-4 h-4" />
                              {sermon.date}
                            </div>
                          )}
                          <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                            <Play className="w-5 h-5 text-white fill-current ml-0.5" />
                          </div>
                        </div>
                      </div>
                    )}
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-slate-900 line-clamp-2">{sermon.title}</h3>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderVideos = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-green-50 to-emerald-50">
          <CardTitle className="flex items-center gap-2 mb-2">
            <Film className="w-6 h-6 text-green-600" />
            Videos
          </CardTitle>
          <p className="text-sm text-slate-600">{media.videos.length} videos available</p>
        </CardHeader>
        <CardContent className="p-6">
          {media.videos.length === 0 ? (
            <div className="text-center py-12">
              <Film className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No Videos Found</h3>
              <p className="text-slate-600">Check back soon for new content</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {media.videos.map((video, idx) => (
                <motion.div
                  key={video.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  whileHover={{ scale: 1.03 }}
                  className="cursor-pointer"
                  onClick={() => window.open(video.videoUrl, '_blank')}
                >
                  <Card className="overflow-hidden border-2 border-transparent hover:border-green-300 hover:shadow-lg transition-all">
                    {video.thumbnail && (
                      <div className="relative">
                        <img
                          src={video.thumbnail}
                          alt={video.title}
                          className="w-full h-40 object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        {video.date && (
                          <Badge className="absolute bottom-2 left-2 bg-white/90 text-slate-900 text-xs">
                            {video.date}
                          </Badge>
                        )}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 hover:opacity-100 transition-opacity">
                          <div className="w-12 h-12 bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center">
                            <Play className="w-6 h-6 text-white fill-current ml-0.5" />
                          </div>
                        </div>
                      </div>
                    )}
                    <CardContent className="p-3">
                      <h3 className="font-medium text-sm line-clamp-2">{video.title}</h3>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderPodcasts = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-pink-50">
          <CardTitle className="flex items-center gap-2">
            <Headphones className="w-6 h-6 text-purple-600" />
            Podcasts
          </CardTitle>
          <p className="text-sm text-slate-600 mt-2">Listen on your favorite podcast platform</p>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {media.podcasts.map((podcast, idx) => (
              <motion.div
                key={podcast.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ scale: 1.03 }}
                className="cursor-pointer"
                onClick={() => window.open(podcast.feedUrl, '_blank')}
              >
                <Card className="overflow-hidden border-2 border-transparent hover:border-purple-300 hover:shadow-xl transition-all">
                  <img
                    src={podcast.thumbnail}
                    alt={podcast.title}
                    className="w-full h-48 object-cover"
                  />
                  <CardContent className="p-4">
                    <Badge className="bg-purple-100 text-purple-700 mb-2">Podcast</Badge>
                    <h3 className="font-semibold text-slate-900 mb-2">{podcast.title}</h3>
                    <p className="text-sm text-slate-600 mb-4 line-clamp-2">{podcast.description}</p>
                    <Button size="sm" variant="outline" className="w-full">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Listen Now
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
          <p className="text-slate-600">Loading media...</p>
        </div>
      );
    }

    switch (section) {
      case 'livestream':
        return renderLiveStream();
      case 'sermons':
        return renderSermons();
      case 'videos':
        return renderVideos();
      case 'podcasts':
        return renderPodcasts();
      default:
        return renderHome();
    }
  };

  const currentSection = sections.find(s => s.id === section);

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 overflow-auto">
      <div className="max-w-7xl mx-auto p-3 sm:p-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-6"
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (section !== 'home') {
                navigate(createPageUrl('MediaPlayer'));
              } else {
                navigate(createPageUrl('Dashboard'));
              }
            }}
            className="hover:bg-white/50"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
              {currentSection ? (
                <currentSection.icon className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600" />
              ) : (
                <Music className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600" />
              )}
              {section === 'home' ? 'FBCA Media' : currentSection?.title}
            </h1>
            <p className="text-sm text-slate-600">
              {section === 'home' 
                ? 'Your spiritual content hub' 
                : currentSection?.description || 'Media content'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={loadMediaData}
              variant="outline"
              size="sm"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {section === 'home' && (
              <Button
                onClick={() => navigate(createPageUrl('MediaPlayer') + '?section=livestream')}
                className={`bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 ${isLive ? 'animate-pulse' : ''}`}
              >
                {isLive && (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-2 h-2 bg-white rounded-full mr-2"
                  />
                )}
                <Radio className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">{isLive ? 'Live Now!' : 'Watch Live'}</span>
                <span className="sm:hidden">Live</span>
              </Button>
            )}
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={section}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}