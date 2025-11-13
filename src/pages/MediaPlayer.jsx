import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Radio,
  Mic2,
  Headphones,
  Music,
  Archive,
  ArrowLeft,
  Clock,
  Calendar,
  User,
  Heart,
  Share2,
  Download,
  ExternalLink,
  Loader2,
  Film
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

export default function MediaPlayer() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const section = searchParams.get('section') || 'home';
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState([75]);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resiData, setResiData] = useState({ collections: [], featured: null });
  const [podcasts, setPodcasts] = useState([]);

  useEffect(() => {
    loadMediaData();
  }, []);

  const loadMediaData = async () => {
    setLoading(true);
    try {
      // Load Resi media
      const resiResponse = await base44.functions.invoke('getResiMedia');
      if (resiResponse.data.success) {
        setResiData(resiResponse.data);
      }

      // Load FBCA podcasts
      const podcastsResponse = await base44.functions.invoke('getFBCAPodcasts');
      if (podcastsResponse.data.success) {
        setPodcasts(podcastsResponse.data.podcasts);
      }
    } catch (error) {
      console.error('Error loading media:', error);
      toast.error('Failed to load media content');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleTrackSelect = (track, type) => {
    setCurrentTrack({ ...track, type });
    setIsPlaying(true);
    toast.success(`Now playing: ${track.title}`);
  };

  const sections = [
    {
      id: 'livestream',
      title: 'Live Stream',
      icon: Radio,
      color: 'from-red-500 to-pink-500',
      description: 'Watch live services'
    },
    {
      id: 'sermons',
      title: 'Sermon Podcast',
      icon: Mic2,
      color: 'from-blue-500 to-indigo-500',
      description: 'Latest messages'
    },
    {
      id: 'podcasts',
      title: 'Podcasts',
      icon: Headphones,
      color: 'from-purple-500 to-pink-500',
      description: 'Church podcasts'
    },
    {
      id: 'videos',
      title: 'Video Library',
      icon: Film,
      color: 'from-green-500 to-emerald-500',
      description: 'Past services'
    },
    {
      id: 'archived',
      title: 'Archived Services',
      icon: Archive,
      color: 'from-orange-500 to-red-500',
      description: 'Full archive'
    }
  ];

  const renderHome = () => {
    // Get Contemporary Worship collection
    const contemporaryCollection = resiData.collections.find(c => 
      c.name.toLowerCase().includes('contemporary')
    );
    const featuredVideo = contemporaryCollection?.videos[0] || resiData.featured;

    return (
      <div className="space-y-6">
        {/* Featured Video Hero */}
        {featuredVideo && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl"
          >
            <div className="relative aspect-video">
              <img
                src={featuredVideo.thumbnail}
                alt={featuredVideo.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-2 bg-red-600 backdrop-blur-sm rounded-full px-3 py-1">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    <span className="text-sm font-semibold text-white">LATEST</span>
                  </div>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">{featuredVideo.title}</h2>
                {featuredVideo.date && (
                  <p className="text-white/90 mb-4">{featuredVideo.date}</p>
                )}
                <Button
                  onClick={() => window.open(featuredVideo.videoUrl, '_blank')}
                  size="lg"
                  className="bg-white text-slate-900 hover:bg-white/90"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Watch Now
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Quick Access Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {sections.map((section, idx) => (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card
                className="cursor-pointer hover:shadow-xl transition-all group"
                onClick={() => navigate(createPageUrl('MediaPlayer') + `?section=${section.id}`)}
              >
                <CardContent className="p-6 text-center">
                  <div className={`w-16 h-16 mx-auto mb-3 bg-gradient-to-br ${section.color} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <section.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-1 text-sm">{section.title}</h3>
                  <p className="text-xs text-slate-500">{section.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Featured Podcasts */}
        {podcasts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Headphones className="w-5 h-5 text-purple-600" />
                Featured Podcasts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {podcasts.slice(0, 2).map((podcast) => (
                  <motion.div
                    key={podcast.id}
                    whileHover={{ scale: 1.02 }}
                    className="cursor-pointer"
                    onClick={() => window.open(podcast.feedUrl, '_blank')}
                  >
                    <Card>
                      <div className="flex gap-4 p-4">
                        <img
                          src={podcast.thumbnail}
                          alt={podcast.title}
                          className="w-24 h-24 rounded-lg object-cover"
                        />
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900 mb-1">{podcast.title}</h3>
                          <p className="text-sm text-slate-600 line-clamp-2">{podcast.description}</p>
                          <Button size="sm" variant="outline" className="mt-2">
                            <ExternalLink className="w-4 h-4 mr-2" />
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

  const renderSermons = () => {
    const sermonsCollection = resiData.collections.find(c => 
      c.name.toLowerCase().includes('sermon')
    );
    const sermons = sermonsCollection?.videos || [];

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic2 className="w-5 h-5 text-blue-600" />
              {sermonsCollection?.name || 'Sermons'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sermons.map((sermon) => (
                <motion.div
                  key={sermon.id}
                  whileHover={{ scale: 1.02 }}
                  className="cursor-pointer"
                  onClick={() => window.open(sermon.videoUrl, '_blank')}
                >
                  <Card className="overflow-hidden">
                    <div className="relative">
                      <img
                        src={sermon.thumbnail}
                        alt={sermon.title}
                        className="w-full h-48 object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-3 left-3 right-3">
                        <Badge className="bg-blue-600 text-white mb-2">Sermon</Badge>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-slate-900 mb-2 line-clamp-2">{sermon.title}</h3>
                      {sermon.date && (
                        <div className="flex items-center text-sm text-slate-500">
                          <Calendar className="w-4 h-4 mr-1" />
                          {sermon.date}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderPodcasts = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Headphones className="w-5 h-5 text-purple-600" />
            FBCA Podcasts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {podcasts.map((podcast) => (
              <motion.div
                key={podcast.id}
                whileHover={{ scale: 1.02 }}
                className="cursor-pointer"
                onClick={() => window.open(podcast.feedUrl, '_blank')}
              >
                <Card>
                  <img
                    src={podcast.thumbnail}
                    alt={podcast.title}
                    className="w-full h-48 object-cover rounded-t-lg"
                  />
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-slate-900 mb-2">{podcast.title}</h3>
                    <p className="text-sm text-slate-600 mb-3 line-clamp-2">{podcast.description}</p>
                    <Button size="sm" variant="outline" className="w-full">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Listen on Transistor
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

  const renderVideos = () => {
    // Show Contemporary and Classic Worship
    const videoCollections = resiData.collections.filter(c => 
      c.name.toLowerCase().includes('worship')
    );

    return (
      <div className="space-y-6">
        {videoCollections.map((collection) => (
          <Card key={collection.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Film className="w-5 h-5 text-green-600" />
                {collection.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {collection.videos.map((video) => (
                  <motion.div
                    key={video.id}
                    whileHover={{ scale: 1.02 }}
                    className="cursor-pointer"
                    onClick={() => window.open(video.videoUrl, '_blank')}
                  >
                    <Card className="overflow-hidden">
                      <div className="relative">
                        <img
                          src={video.thumbnail}
                          alt={video.title}
                          className="w-full h-48 object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute bottom-3 left-3 right-3">
                          {video.date && (
                            <Badge className="bg-white/20 backdrop-blur-sm text-white">
                              {video.date}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-slate-900 text-sm line-clamp-2">
                          {video.title}
                        </h3>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderArchived = () => {
    const allCollections = resiData.collections;

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-orange-600" />
              Complete Video Archive
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allCollections.map((collection) => (
              <div key={collection.id} className="mb-8">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">{collection.name}</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {collection.videos.map((video) => (
                    <motion.div
                      key={video.id}
                      whileHover={{ scale: 1.02 }}
                      className="cursor-pointer"
                      onClick={() => window.open(video.videoUrl, '_blank')}
                    >
                      <Card className="overflow-hidden">
                        <img
                          src={video.thumbnail}
                          alt={video.title}
                          className="w-full h-32 object-cover"
                        />
                        <CardContent className="p-3">
                          <h4 className="font-medium text-sm line-clamp-2">{video.title}</h4>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderLiveStream = () => (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="relative aspect-video bg-gradient-to-br from-slate-900 to-slate-800">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white">
              <Radio className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-semibold mb-2">Live Stream</h3>
              <p className="text-white/70 mb-4">Check back during service times</p>
              <Button
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white hover:text-slate-900"
                onClick={() => window.open('https://sites.resi.io/fbcamedia', '_blank')}
              >
                <ExternalLink className="w-5 h-5 mr-2" />
                Open Resi Media Site
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      );
    }

    switch (section) {
      case 'livestream':
        return renderLiveStream();
      case 'sermons':
        return renderSermons();
      case 'podcasts':
        return renderPodcasts();
      case 'videos':
        return renderVideos();
      case 'archived':
        return renderArchived();
      default:
        return renderHome();
    }
  };

  return (
    <div className="h-full bg-gradient-to-br from-slate-50 to-blue-50 overflow-auto">
      <div className="max-w-7xl mx-auto p-3 sm:p-6 pb-32">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
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
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
              <Volume2 className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600" />
              FBCA Media
            </h1>
            <p className="text-sm text-slate-600">
              {section === 'home' ? 'Your spiritual content hub' : sections.find(s => s.id === section)?.title}
            </p>
          </div>
        </div>

        {/* Content */}
        {renderContent()}
      </div>
    </div>
  );
}