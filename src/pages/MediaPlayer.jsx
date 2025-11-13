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
  Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";

export default function MediaPlayer() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const section = searchParams.get('section') || 'home';
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState([75]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isLiveStreamActive, setIsLiveStreamActive] = useState(false);

  // Sample data - replace with real Resi API calls
  const featuredContent = {
    liveStream: {
      title: "Sunday Service - Live Now",
      speaker: "Pastor John Smith",
      thumbnail: "https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=800&q=80",
      isLive: true
    },
    latestSermon: {
      title: "Faith in Action: Walking the Talk",
      speaker: "Pastor John Smith",
      date: "December 15, 2024",
      duration: "42:15",
      thumbnail: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80"
    }
  };

  const sermons = [
    {
      id: 1,
      title: "Faith in Action: Walking the Talk",
      speaker: "Pastor John Smith",
      date: "December 15, 2024",
      duration: "42:15",
      thumbnail: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80",
      series: "Living Faith"
    },
    {
      id: 2,
      title: "The Power of Prayer",
      speaker: "Pastor Sarah Johnson",
      date: "December 8, 2024",
      duration: "38:42",
      thumbnail: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80",
      series: "Spiritual Foundations"
    },
    {
      id: 3,
      title: "Love Your Neighbor",
      speaker: "Pastor John Smith",
      date: "December 1, 2024",
      duration: "45:20",
      thumbnail: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80",
      series: "Living Faith"
    }
  ];

  const podcasts = [
    {
      id: 1,
      title: "Faith & Culture",
      description: "Conversations about faith in modern life",
      episodes: 42,
      thumbnail: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=400&q=80"
    },
    {
      id: 2,
      title: "Youth Talk",
      description: "Real talk for young believers",
      episodes: 28,
      thumbnail: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=400&q=80"
    },
    {
      id: 3,
      title: "Worship Stories",
      description: "Behind the music of worship",
      episodes: 15,
      thumbnail: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80"
    }
  ];

  const worshipSongs = [
    {
      id: 1,
      title: "Goodness of God",
      artist: "FBCA Worship Team",
      album: "Sunday Worship Vol. 3",
      duration: "4:32",
      thumbnail: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&q=80"
    },
    {
      id: 2,
      title: "Way Maker",
      artist: "FBCA Worship Team",
      album: "Sunday Worship Vol. 3",
      duration: "5:18",
      thumbnail: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&q=80"
    },
    {
      id: 3,
      title: "What a Beautiful Name",
      artist: "FBCA Worship Team",
      album: "Sunday Worship Vol. 2",
      duration: "4:45",
      thumbnail: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&q=80"
    }
  ];

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleMute = () => {
    setIsMuted(!isMuted);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
      id: 'music',
      title: 'Media Player',
      icon: Music,
      color: 'from-green-500 to-emerald-500',
      description: 'Worship songs'
    },
    {
      id: 'archived',
      title: 'Archived Services',
      icon: Archive,
      color: 'from-orange-500 to-red-500',
      description: 'Past services'
    }
  ];

  const renderHome = () => (
    <div className="space-y-6">
      {/* Live Stream Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-500 to-pink-600 p-8 text-white"
      >
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-semibold">LIVE NOW</span>
            </div>
          </div>
          <h2 className="text-3xl font-bold mb-2">{featuredContent.liveStream.title}</h2>
          <p className="text-white/90 mb-6">{featuredContent.liveStream.speaker}</p>
          <Button
            onClick={() => {
              setCurrentTrack({ ...featuredContent.liveStream, type: 'livestream' });
              setIsPlaying(true);
            }}
            size="lg"
            className="bg-white text-red-600 hover:bg-white/90"
          >
            <Play className="w-5 h-5 mr-2" />
            Watch Live
          </Button>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
      </motion.div>

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
                <h3 className="font-semibold text-slate-900 mb-1">{section.title}</h3>
                <p className="text-xs text-slate-500">{section.description}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Latest Sermon */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic2 className="w-5 h-5 text-blue-600" />
            Latest Sermon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <img
              src={featuredContent.latestSermon.thumbnail}
              alt={featuredContent.latestSermon.title}
              className="w-32 h-32 rounded-lg object-cover"
            />
            <div className="flex-1">
              <h3 className="font-semibold text-lg text-slate-900 mb-1">
                {featuredContent.latestSermon.title}
              </h3>
              <p className="text-slate-600 mb-2">{featuredContent.latestSermon.speaker}</p>
              <div className="flex items-center gap-4 text-sm text-slate-500 mb-3">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {featuredContent.latestSermon.date}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {featuredContent.latestSermon.duration}
                </span>
              </div>
              <Button
                onClick={() => handleTrackSelect(featuredContent.latestSermon, 'sermon')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Play className="w-4 h-4 mr-2" />
                Listen Now
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderSermons = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic2 className="w-5 h-5 text-blue-600" />
            Recent Sermons
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sermons.map((sermon) => (
              <motion.div
                key={sermon.id}
                whileHover={{ scale: 1.02 }}
                className="cursor-pointer"
                onClick={() => handleTrackSelect(sermon, 'sermon')}
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
                      <Badge className="bg-blue-600 text-white mb-2">{sermon.series}</Badge>
                      <p className="text-white text-sm font-medium">{sermon.duration}</p>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-slate-900 mb-2">{sermon.title}</h3>
                    <div className="flex items-center justify-between text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {sermon.speaker}
                      </span>
                      <span>{format(new Date(sermon.date), 'MMM d')}</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderPodcasts = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Headphones className="w-5 h-5 text-purple-600" />
            Church Podcasts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            {podcasts.map((podcast) => (
              <motion.div
                key={podcast.id}
                whileHover={{ scale: 1.02 }}
                className="cursor-pointer"
              >
                <Card>
                  <img
                    src={podcast.thumbnail}
                    alt={podcast.title}
                    className="w-full h-48 object-cover rounded-t-lg"
                  />
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-slate-900 mb-2">{podcast.title}</h3>
                    <p className="text-sm text-slate-600 mb-3">{podcast.description}</p>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">{podcast.episodes} episodes</Badge>
                      <Button size="sm" variant="outline">
                        <Play className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderMusic = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="w-5 h-5 text-green-600" />
            Worship Music
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {worshipSongs.map((song) => (
              <motion.div
                key={song.id}
                whileHover={{ scale: 1.01 }}
                className="flex items-center gap-4 p-4 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => handleTrackSelect(song, 'music')}
              >
                <img
                  src={song.thumbnail}
                  alt={song.title}
                  className="w-16 h-16 rounded-lg object-cover"
                />
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">{song.title}</h3>
                  <p className="text-sm text-slate-600">{song.artist}</p>
                </div>
                <div className="text-sm text-slate-500">{song.duration}</div>
                <Button size="sm" variant="ghost">
                  <Play className="w-4 h-4" />
                </Button>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderArchived = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-orange-600" />
            Archived Services
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Archive className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Coming Soon</h3>
            <p className="text-slate-600">
              Access our complete library of past services and special events
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderLiveStream = () => (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="relative aspect-video bg-gradient-to-br from-slate-900 to-slate-800">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white">
              <Radio className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-semibold mb-2">Live Stream Player</h3>
              <p className="text-white/70 mb-4">Ready to connect to Resi stream</p>
              <Button
                size="lg"
                className="bg-red-600 hover:bg-red-700"
                onClick={() => {
                  toast.success('Connecting to live stream...');
                  setIsPlaying(true);
                }}
              >
                <Play className="w-5 h-5 mr-2" />
                Start Watching
              </Button>
            </div>
          </div>
        </div>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-sm font-semibold text-red-600">LIVE</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Sunday Morning Service
          </h2>
          <p className="text-slate-600">Join us live for worship and teaching</p>
        </CardContent>
      </Card>
    </div>
  );

  const renderContent = () => {
    switch (section) {
      case 'livestream':
        return renderLiveStream();
      case 'sermons':
        return renderSermons();
      case 'podcasts':
        return renderPodcasts();
      case 'music':
        return renderMusic();
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

      {/* Now Playing Bar */}
      <AnimatePresence>
        {currentTrack && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-16 left-0 right-0 bg-slate-900 text-white shadow-2xl z-40"
          >
            <div className="max-w-7xl mx-auto">
              {/* Progress Bar */}
              <div className="h-1 bg-slate-700">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                  style={{ width: `${(currentTime / 240) * 100}%` }}
                />
              </div>

              <div className="p-4">
                <div className="flex items-center gap-4">
                  {/* Track Info */}
                  <img
                    src={currentTrack.thumbnail || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&q=80'}
                    alt={currentTrack.title}
                    className="w-14 h-14 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{currentTrack.title}</h3>
                    <p className="text-sm text-white/70 truncate">
                      {currentTrack.speaker || currentTrack.artist || 'FBCA'}
                    </p>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-white hover:bg-white/10"
                    >
                      <SkipBack className="w-5 h-5" />
                    </Button>
                    <Button
                      size="icon"
                      onClick={handlePlayPause}
                      className="bg-white text-slate-900 hover:bg-white/90 w-12 h-12"
                    >
                      {isPlaying ? (
                        <Pause className="w-5 h-5" />
                      ) : (
                        <Play className="w-5 h-5" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-white hover:bg-white/10"
                    >
                      <SkipForward className="w-5 h-5" />
                    </Button>
                  </div>

                  {/* Volume */}
                  <div className="hidden md:flex items-center gap-2 w-32">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleMute}
                      className="text-white hover:bg-white/10"
                    >
                      {isMuted ? (
                        <VolumeX className="w-5 h-5" />
                      ) : (
                        <Volume2 className="w-5 h-5" />
                      )}
                    </Button>
                    <Slider
                      value={volume}
                      onValueChange={setVolume}
                      max={100}
                      step={1}
                      className="flex-1"
                    />
                  </div>

                  {/* Actions */}
                  <div className="hidden lg:flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-white hover:bg-white/10"
                    >
                      <Heart className="w-5 h-5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-white hover:bg-white/10"
                    >
                      <Share2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}