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
  Archive,
  ArrowLeft,
  Calendar,
  ExternalLink,
  Loader2,
  Film,
  Volume2,
  ChevronRight,
  Clock,
  TrendingUp,
  Sparkles,
  Youtube
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
  const [resiData, setResiData] = useState({ collections: [], featured: null });
  const [youtubeVideos, setYoutubeVideos] = useState([]);
  const [podcasts, setPodcasts] = useState([]);
  const [isLive, setIsLive] = useState(false);
  const [checkingLive, setCheckingLive] = useState(true);

  useEffect(() => {
    loadMediaData();
    checkLiveStatus();
    // Check live status every 2 minutes
    const liveCheckInterval = setInterval(checkLiveStatus, 120000);
    return () => clearInterval(liveCheckInterval);
  }, []);

  const checkLiveStatus = async () => {
    setCheckingLive(true);
    try {
      const now = new Date();
      const day = now.getDay();
      const hour = now.getHours();
      const minute = now.getMinutes();
      const currentMinutes = hour * 60 + minute;

      const sundayMorning1Start = 540 - 15;
      const sundayMorning1End = 540 + 75;
      const sundayMorning2Start = 645 - 15;
      const sundayMorning2End = 645 + 75;
      const wednesdayEveningStart = 1110 - 15;
      const wednesdayEveningEnd = 1110 + 90;

      let live = false;
      if (day === 0) {
        live = (currentMinutes >= sundayMorning1Start && currentMinutes <= sundayMorning1End) ||
               (currentMinutes >= sundayMorning2Start && currentMinutes <= sundayMorning2End);
      } else if (day === 3) {
        live = currentMinutes >= wednesdayEveningStart && currentMinutes <= wednesdayEveningEnd;
      }

      setIsLive(live);
    } catch (error) {
      console.error('Error checking live status:', error);
      setIsLive(false);
    } finally {
      setCheckingLive(false);
    }
  };

  const loadMediaData = async () => {
    setLoading(true);
    try {
      const [resiResponse, youtubeResponse, podcastsResponse] = await Promise.all([
        base44.functions.invoke('getResiMedia').catch(() => ({ data: { success: false } })),
        base44.functions.invoke('getYouTubeVideos').catch(() => ({ data: { success: false } })),
        base44.functions.invoke('getFBCAPodcasts').catch(() => ({ data: { success: false } }))
      ]);

      if (resiResponse.data.success) {
        setResiData(resiResponse.data);
      }

      if (youtubeResponse.data.success) {
        setYoutubeVideos(youtubeResponse.data.videos || []);
      }

      if (podcastsResponse.data.success) {
        setPodcasts(podcastsResponse.data.podcasts || []);
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
      id: 'youtube',
      title: 'YouTube',
      icon: Youtube,
      color: 'from-red-600 to-red-500',
      description: 'Latest videos'
    },
    {
      id: 'sermons',
      title: 'Sermons',
      icon: Mic2,
      color: 'from-blue-500 to-indigo-500',
      description: 'Latest messages'
    },
    {
      id: 'podcasts',
      title: 'Podcasts',
      icon: Headphones,
      color: 'from-purple-500 to-pink-500',
      description: '6 shows'
    },
    {
      id: 'videos',
      title: 'Worship Services',
      icon: Film,
      color: 'from-green-500 to-emerald-500',
      description: 'Past services'
    }
  ];

  const renderHome = () => {
    // Featured video - prioritize YouTube, then Resi
    const featuredVideo = youtubeVideos[0] || resiData.featured;
    const sermonsCollection = resiData.collections.find(c => 
      c.name.toLowerCase().includes('sermon')
    );

    return (
      <div className="space-y-6">
        {/* Hero Section - Featured Video */}
        {featuredVideo && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl shadow-2xl"
          >
            <div className="relative aspect-video">
              <img
                src={featuredVideo.thumbnail}
                alt={featuredVideo.title}
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
                  {featuredVideo.title}
                </h2>
                {featuredVideo.publishedAt && (
                  <p className="text-white/90 mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(featuredVideo.publishedAt), 'MMMM d, yyyy')}
                  </p>
                )}
                <div className="flex gap-3">
                  <Button
                    onClick={() => window.open(featuredVideo.videoUrl, '_blank')}
                    size="lg"
                    className="bg-white text-slate-900 hover:bg-white/90 shadow-xl"
                  >
                    <Play className="w-5 h-5 mr-2 fill-current" />
                    Watch Now
                  </Button>
                  <Button
                    onClick={() => navigate(createPageUrl('MediaPlayer') + '?section=youtube')}
                    size="lg"
                    variant="outline"
                    className="border-white text-white hover:bg-white/20 backdrop-blur-sm"
                  >
                    More Videos
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Quick Access Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
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

        {/* Latest YouTube Videos */}
        {youtubeVideos.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Youtube className="w-5 h-5 text-red-600" />
                Latest from YouTube
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(createPageUrl('MediaPlayer') + '?section=youtube')}
              >
                View All <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                {youtubeVideos.slice(0, 3).map((video) => (
                  <motion.div
                    key={video.id}
                    whileHover={{ scale: 1.03 }}
                    className="cursor-pointer"
                    onClick={() => window.open(video.videoUrl, '_blank')}
                  >
                    <Card className="overflow-hidden border-2 border-transparent hover:border-red-300 transition-all">
                      <div className="relative">
                        <img
                          src={video.thumbnail}
                          alt={video.title}
                          className="w-full h-40 object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                        <Badge className="absolute top-2 left-2 bg-red-600 text-white">
                          YouTube
                        </Badge>
                        <div className="absolute bottom-2 left-2 right-2">
                          {video.publishedAt && (
                            <p className="text-xs text-white/90">
                              {format(new Date(video.publishedAt), 'MMM d, yyyy')}
                            </p>
                          )}
                        </div>
                      </div>
                      <CardContent className="p-3">
                        <h3 className="font-semibold text-sm line-clamp-2">{video.title}</h3>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Latest Sermons Row */}
        {sermonsCollection && sermonsCollection.videos.length > 0 && (
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
                {sermonsCollection.videos.slice(0, 3).map((sermon) => (
                  <motion.div
                    key={sermon.id}
                    whileHover={{ scale: 1.03 }}
                    className="cursor-pointer"
                    onClick={() => window.open(sermon.videoUrl, '_blank')}
                  >
                    <Card className="overflow-hidden border-2 border-transparent hover:border-blue-300 transition-all">
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
                        <div className="absolute bottom-2 left-2 right-2">
                          {sermon.date && (
                            <p className="text-xs text-white/90">{sermon.date}</p>
                          )}
                        </div>
                      </div>
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
        {podcasts.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Headphones className="w-5 h-5 text-purple-600" />
                Featured Podcasts
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
                {podcasts.slice(0, 2).map((podcast) => (
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
            src="https://www.fbca.org/watch-listen/live/"
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
                  <span>Sundays: 9:00 AM & 10:45 AM</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>Wednesdays: 6:30 PM</span>
                </div>
              </div>
            </div>
            <Button
              onClick={() => window.open('https://www.fbca.org/watch-listen/live/', '_blank')}
              variant="outline"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Full Page
            </Button>
          </div>
          
          <div className="border-t pt-4">
            <p className="text-sm text-slate-600 mb-3">
              Can't watch live? Check out our archived services and sermons.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => navigate(createPageUrl('MediaPlayer') + '?section=youtube')}
              >
                <Youtube className="w-4 h-4 mr-2" />
                YouTube
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(createPageUrl('MediaPlayer') + '?section=sermons')}
              >
                <Mic2 className="w-4 h-4 mr-2" />
                Sermons
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderYouTube = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-red-50 to-pink-50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 mb-2">
                <Youtube className="w-6 h-6 text-red-600" />
                FBCA YouTube Channel
              </CardTitle>
              <p className="text-sm text-slate-600">{youtubeVideos.length} recent videos</p>
            </div>
            <Button
              onClick={() => window.open('https://youtube.com/@firstbaptistarlington', '_blank')}
              variant="outline"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open YouTube
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {youtubeVideos.map((video, idx) => (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ scale: 1.03 }}
                className="cursor-pointer"
                onClick={() => window.open(video.videoUrl, '_blank')}
              >
                <Card className="overflow-hidden border-2 border-transparent hover:border-red-300 hover:shadow-xl transition-all">
                  <div className="relative">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-full h-48 object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute top-3 left-3">
                      <Badge className="bg-red-600 text-white">YouTube</Badge>
                    </div>
                    <div className="absolute bottom-3 left-3 right-3">
                      {video.publishedAt && (
                        <div className="flex items-center text-white text-sm gap-1">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(video.publishedAt), 'MMM d, yyyy')}
                        </div>
                      )}
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-slate-900 line-clamp-2">{video.title}</h3>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderSermons = () => {
    const sermonsCollection = resiData.collections.find(c => 
      c.name.toLowerCase().includes('sermon')
    );
    const sermons = sermonsCollection?.videos || [];

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader className="border-b bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 mb-2">
                  <Mic2 className="w-6 h-6 text-blue-600" />
                  {sermonsCollection?.name || 'Sermons'}
                </CardTitle>
                <p className="text-sm text-slate-600">{sermons.length} messages available</p>
              </div>
              {sermonsCollection && (
                <Button
                  onClick={() => window.open(sermonsCollection.url, '_blank')}
                  variant="outline"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View on Resi
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {sermons.length === 0 ? (
              <div className="text-center py-12">
                <Mic2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No Sermons Found</h3>
                <p className="text-slate-600 mb-4">Check out our YouTube channel for the latest messages</p>
                <Button
                  onClick={() => navigate(createPageUrl('MediaPlayer') + '?section=youtube')}
                >
                  <Youtube className="w-4 h-4 mr-2" />
                  Go to YouTube
                </Button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sermons.map((sermon, idx) => (
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
                      <div className="relative">
                        <img
                          src={sermon.thumbnail}
                          alt={sermon.title}
                          className="w-full h-48 object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                        <div className="absolute top-3 left-3">
                          <Badge className="bg-blue-600 text-white">Sermon</Badge>
                        </div>
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
  };

  const renderPodcasts = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-pink-50">
          <CardTitle className="flex items-center gap-2">
            <Headphones className="w-6 h-6 text-purple-600" />
            FBCA Podcasts
          </CardTitle>
          <p className="text-sm text-slate-600 mt-2">Listen on your favorite podcast platform</p>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {podcasts.map((podcast, idx) => (
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
    const videoCollections = resiData.collections.filter(c => 
      c.name.toLowerCase().includes('worship')
    );

    return (
      <div className="space-y-6">
        {videoCollections.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Film className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No Worship Services Found</h3>
              <p className="text-slate-600 mb-4">Check out our YouTube channel for full worship services</p>
              <Button
                onClick={() => navigate(createPageUrl('MediaPlayer') + '?section=youtube')}
              >
                <Youtube className="w-4 h-4 mr-2" />
                Go to YouTube
              </Button>
            </CardContent>
          </Card>
        ) : (
          videoCollections.map((collection) => (
            <Card key={collection.id}>
              <CardHeader className="border-b bg-gradient-to-r from-green-50 to-emerald-50">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 mb-2">
                      <Film className="w-6 h-6 text-green-600" />
                      {collection.name}
                    </CardTitle>
                    <p className="text-sm text-slate-600">{collection.videos.length} services</p>
                  </div>
                  <Button
                    onClick={() => window.open(collection.url, '_blank')}
                    variant="outline"
                    size="sm"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {collection.videos.map((video, idx) => (
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
                        <CardContent className="p-3">
                          <h3 className="font-medium text-sm line-clamp-2">{video.title}</h3>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
          <p className="text-slate-600">Loading FBCA media...</p>
        </div>
      );
    }

    switch (section) {
      case 'livestream':
        return renderLiveStream();
      case 'youtube':
        return renderYouTube();
      case 'sermons':
        return renderSermons();
      case 'podcasts':
        return renderPodcasts();
      case 'videos':
        return renderVideos();
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