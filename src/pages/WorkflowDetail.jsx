
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  Loader2,
  Send,
  Target,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  FileText,
  User,
  Calendar as CalendarIcon,
  Building2
} from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function WorkflowDetail() {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('id');
  const navigate = useNavigate();

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Minister Goal Review Chat State
  const [chatMessages, setChatMessages] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [goalReviewComplete, setGoalReviewComplete] = useState(false);
  const [conversationStarted, setConversationStarted] = useState(false);

  useEffect(() => {
    if (requestId) {
      loadRequest();
      loadUser();
    }
  }, [requestId]);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const loadRequest = async () => {
    setLoading(true);
    try {
      const req = await base44.entities.WorkflowRequest.filter({ id: requestId });
      if (req && req.length > 0) {
        const foundRequest = req[0];
        setRequest(foundRequest);

        // Check if goal review is complete
        if (foundRequest.goal_review_data?.completed) {
          setGoalReviewComplete(true);
        }

        // Load existing conversation for goal review
        if (foundRequest.status === 'minister_goal_review' && foundRequest.goal_review_data?.chat_history) {
          setChatMessages(foundRequest.goal_review_data.chat_history);
          setConversationStarted(true);
        }
      } else {
        toast.error('Request not found');
        navigate(createPageUrl('WorkflowHub'));
      }
    } catch (error) {
      console.error('Error loading request:', error);
      toast.error('Failed to load request');
    } finally {
      setLoading(false);
    }
  };

  const startGoalReview = async () => {
    setConversationStarted(true);
    setIsAIThinking(true);

    try {
      // Initial AI greeting
      const context = {
        event_name: request.title,
        ministry: request.ministry_department,
        event_date: request.pco_event_date || request.goal_review_data?.event_date,
        is_youth_college: request.ministry_department?.toLowerCase().includes('youth') || 
                          request.ministry_department?.toLowerCase().includes('college'),
        need_type: request.goal_review_data?.need_type
      };

      const initialPrompt = `You are a ministry communications consultant helping plan effective outreach. 
      
Event: ${context.event_name}
Ministry: ${context.ministry}
Date: ${context.event_date ? format(new Date(context.event_date), 'PPP') : 'TBD'}
${context.is_youth_college ? '(Youth/College Event - typically no childcare needed)' : ''}
Type: ${context.need_type}

Start the conversation naturally. Your goal is to understand:
1. WHY they're promoting (emotional/spiritual/relational impact) - ask this FIRST
2. What attendees should walk away with (feeling, learning, relationship)
3. Shape, Shepherd, Serving, Sent (4 S's framework for ministry)
4. Practical logistics (childcare, registration, etc.)

Be direct, concise, and to-the-point. No overly happy language. Get to the heart of ministry impact.

Start with a brief greeting and ask the FIRST key question about what they hope attendees will walk away with emotionally, spiritually, or relationally.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: initialPrompt,
        add_context_from_internet: false
      });

      const aiMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString()
      };

      setChatMessages([aiMessage]);

      // Save to database
      await base44.entities.WorkflowRequest.update(requestId, {
        goal_review_data: {
          ...request.goal_review_data,
          chat_history: [aiMessage],
          started_at: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error starting goal review:', error);
      toast.error('Failed to start conversation');
    } finally {
      setIsAIThinking(false);
    }
  };

  const sendMessage = async () => {
    if (!userInput.trim() || isAIThinking) return;

    const userMessage = {
      role: 'user',
      content: userInput.trim(),
      timestamp: new Date().toISOString()
    };

    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);
    setUserInput("");
    setIsAIThinking(true);

    try {
      // Build conversation context
      const conversationHistory = newMessages.map(m => 
        `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
      ).join('\n\n');

      const context = {
        event_name: request.title,
        ministry: request.ministry_department,
        event_date: request.pco_event_date || request.goal_review_data?.event_date,
        is_youth_college: request.ministry_department?.toLowerCase().includes('youth') || 
                          request.ministry_department?.toLowerCase().includes('college'),
        need_type: request.goal_review_data?.need_type,
        conversation_so_far: conversationHistory
      };

      const prompt = `You are a ministry communications consultant. Continue the conversation to understand ministry impact.

Event: ${context.event_name}
Ministry: ${context.ministry}
${context.is_youth_college ? '(Youth/College Event)' : ''}

Conversation so far:
${context.conversation_so_far}

Key areas to explore (if not yet covered):
1. ✅ FIRST: What should attendees walk away with? (emotional/spiritual/relational)
2. Shape, Shepherd, Serving, Sent framework
3. Practical logistics (childcare, registration, Church Center link)

RULES:
- Be direct and concise
- Ask ONE question at a time
- If you've asked the same thing 2-3 times and got vague answers, move on
- ${context.is_youth_college ? 'Skip childcare questions for youth/college events' : 'Ask about childcare if relevant'}
- When you have enough information about ministry impact and goals (usually after 4-6 exchanges), say "I have everything I need. Let me summarize..." and provide a brief summary

Respond naturally to their last message and guide toward uncovered areas.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        add_context_from_internet: false
      });

      const aiMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString()
      };

      const updatedMessages = [...newMessages, aiMessage];
      setChatMessages(updatedMessages);

      // Check if AI is done (mentions "summary" or "everything I need")
      const isDone = response.toLowerCase().includes('everything i need') || 
                     response.toLowerCase().includes('let me summarize');

      // Save to database
      await base44.entities.WorkflowRequest.update(requestId, {
        goal_review_data: {
          ...request.goal_review_data,
          chat_history: updatedMessages,
          completed: isDone,
          completed_at: isDone ? new Date().toISOString() : null
        }
      });

      if (isDone) {
        setGoalReviewComplete(true);
      }

    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsAIThinking(false);
    }
  };

  const moveToProjectReview = async () => {
    try {
      await base44.entities.WorkflowRequest.update(requestId, {
        status: 'project_review'
      });

      toast.success('Moved to Project Review!');
      await loadRequest();
    } catch (error) {
      console.error('Error moving to project review:', error);
      toast.error('Failed to move to project review');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'minister_goal_review': { label: 'Minister Goal Review', color: 'bg-purple-100 text-purple-700', icon: Target },
      'project_review': { label: 'Project Review', color: 'bg-orange-100 text-orange-700', icon: FileText },
      'campaign_running': { label: 'Campaign Running', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
      'completed': { label: 'Completed', color: 'bg-slate-100 text-slate-700', icon: CheckCircle2 }
    };

    const badge = badges[status] || { label: status, color: 'bg-slate-100 text-slate-700', icon: FileText };
    const Icon = badge.icon;

    return (
      <Badge className={badge.color}>
        <Icon className="w-4 h-4 mr-1" />
        {badge.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!request) {
    return null;
  }

  return (
    <div className="h-full bg-gradient-to-br from-purple-50 to-pink-50 overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(createPageUrl('WorkflowHub'))}
              >
                ← Back
              </Button>
              <span className="font-mono text-sm text-slate-500">{request.request_number}</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">{request.title}</h1>
            <div className="flex items-center gap-3 flex-wrap">
              {getStatusBadge(request.status)}
              {request.ministry_department && (
                <Badge variant="outline">
                  <Building2 className="w-3 h-3 mr-1" />
                  {request.ministry_department}
                </Badge>
              )}
              {request.pco_event_date && (
                <Badge variant="outline">
                  <CalendarIcon className="w-3 h-3 mr-1" />
                  {format(new Date(request.pco_event_date), 'MMM d, yyyy')}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Minister Goal Review Section */}
        {request.status === 'minister_goal_review' && (
          <Card className="border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-purple-600" />
                Minister Goal Review
              </CardTitle>
              <p className="text-sm text-slate-600 mt-2">
                Let's discuss your ministry goals and the impact you want to make. 
                Not sure where to begin? <a href="mailto:communications@fbcarlington.org" className="text-purple-600 hover:underline">Email me to schedule a time to meet!</a>
              </p>
            </CardHeader>
            <CardContent>
              {!conversationStarted ? (
                <div className="text-center py-8">
                  <p className="text-slate-700 mb-6">
                    I'll ask you a few questions to understand the heart behind your event. This should take about 5 minutes.
                  </p>
                  <Button
                    onClick={startGoalReview}
                    className="bg-purple-600 hover:bg-purple-700"
                    size="lg"
                  >
                    <MessageSquare className="w-5 h-5 mr-2" />
                    Start Conversation
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Chat Messages */}
                  <div className="bg-white rounded-lg border border-purple-200 p-4 max-h-96 overflow-y-auto space-y-4">
                    <AnimatePresence>
                      {chatMessages.map((message, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[80%] rounded-lg p-3 ${
                            message.role === 'user' 
                              ? 'bg-purple-600 text-white' 
                              : 'bg-slate-100 text-slate-900'
                          }`}>
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            <p className="text-xs mt-1 opacity-70">
                              {format(new Date(message.timestamp), 'h:mm a')}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {isAIThinking && (
                      <div className="flex justify-start">
                        <div className="bg-slate-100 rounded-lg p-3">
                          <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Input Area */}
                  {!goalReviewComplete && (
                    <div className="flex gap-2">
                      <Textarea
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                        placeholder="Type your response..."
                        className="resize-none"
                        rows={2}
                      />
                      <Button
                        onClick={sendMessage}
                        disabled={!userInput.trim() || isAIThinking}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  {/* Complete Button */}
                  {goalReviewComplete && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border-t border-purple-200 pt-4"
                    >
                      <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-6 h-6 text-green-600" />
                          <div>
                            <p className="font-semibold text-green-900">Goal Review Complete!</p>
                            <p className="text-sm text-green-700">Ready to move to Project Review</p>
                          </div>
                        </div>
                        <Button
                          onClick={moveToProjectReview}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Move to Project Review
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Request Details */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Request Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-slate-500">Requestor</p>
                <p className="font-medium">{request.requestor_name}</p>
                <p className="text-sm text-slate-600">{request.requestor_email}</p>
              </div>

              {request.description && (
                <div>
                  <p className="text-sm text-slate-500">Description</p>
                  <p className="text-sm text-slate-700">{request.description}</p>
                </div>
              )}

              {request.goal_review_data?.need_type && (
                <div>
                  <p className="text-sm text-slate-500">Type</p>
                  <Badge variant="outline" className="capitalize">
                    {request.goal_review_data.need_type}
                  </Badge>
                </div>
              )}

              <div>
                <p className="text-sm text-slate-500">Created</p>
                <p className="text-sm text-slate-700">
                  {format(new Date(request.created_date), 'PPP p')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Graphics Items - FIXED NULL CHECK */}
          {request.goal_review_data?.graphics_items && Object.keys(request.goal_review_data.graphics_items).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Graphics Requested</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(request.goal_review_data.graphics_items)
                    .filter(([_, value]) => value)
                    .map(([key, _]) => (
                      <div key={key} className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="text-sm capitalize">{key.replace(/_/g, ' ')}</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Marketing Channels - FIXED NULL CHECK */}
          {request.goal_review_data?.marketing_channels && Object.keys(request.goal_review_data.marketing_channels).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Marketing Channels</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(request.goal_review_data.marketing_channels)
                    .filter(([_, value]) => value)
                    .map(([key, _]) => (
                      <div key={key} className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        <span className="text-sm capitalize">{key.replace(/_/g, ' ')}</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Links */}
          {(request.goal_review_data?.graphics_folder_link || request.goal_review_data?.marketing_assets_link) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Links</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {request.goal_review_data.graphics_folder_link && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Graphics Folder</p>
                    <a 
                      href={request.goal_review_data.graphics_folder_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-purple-600 hover:underline break-all"
                    >
                      {request.goal_review_data.graphics_folder_link}
                    </a>
                  </div>
                )}
                {request.goal_review_data.marketing_assets_link && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Marketing Assets</p>
                    <a 
                      href={request.goal_review_data.marketing_assets_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-purple-600 hover:underline break-all"
                    >
                      {request.goal_review_data.marketing_assets_link}
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Conversation History */}
        {request.conversation_history && request.conversation_history.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Activity Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {request.conversation_history.map((item, idx) => (
                  <div key={idx} className="flex gap-3 pb-3 border-b last:border-0">
                    <User className="w-4 h-4 text-slate-400 mt-1" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">{item.author}</p>
                      <p className="text-sm text-slate-600">{item.message}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {format(new Date(item.timestamp), 'PPP p')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
