import React, { useState, useEffect, useRef } from "react";
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
  const [sendingEmail, setSendingEmail] = useState(false);

  // Minister Goal Review Chat State
  const [chatMessages, setChatMessages] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [goalReviewComplete, setGoalReviewComplete] = useState(false);
  const [conversationStarted, setConversationStarted] = useState(false);
  
  // Auto-scroll ref
  const chatContainerRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (requestId) {
      loadRequest();
      loadUser();
    }
  }, [requestId]);

  // Auto-scroll when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isAIThinking]);

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

  const handleResendEmail = async () => {
    setSendingEmail(true);
    try {
      const response = await base44.functions.invoke('resendIntakeEmail', {
        request_id: requestId
      });

      if (response.data.success) {
        toast.success(`Email sent to ${response.data.email_sent_to}!`);
        await loadRequest(); // Reload to show updated email status
      } else {
        toast.error('Failed to send email');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  const startGoalReview = async () => {
    setConversationStarted(true);
    setIsAIThinking(true);

    try {
      const context = {
        event_name: request.title,
        ministry: request.ministry_department,
        event_date: request.pco_event_date || request.goal_review_data?.event_date,
        is_youth_college: request.ministry_department?.toLowerCase().includes('youth') || 
                          request.ministry_department?.toLowerCase().includes('college'),
        need_type: request.goal_review_data?.need_type
      };

      const initialPrompt = `You are a ministry communications consultant gathering event details. Keep responses brief and professional.

Event: ${context.event_name}
Ministry: ${context.ministry}
Type: ${context.need_type}

Start by asking about the event theme.`;

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
      const conversationHistory = newMessages.map(m => 
        `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
      ).join('\n\n');

      const messageCount = newMessages.filter(m => m.role === 'user').length;

      const context = {
        event_name: request.title,
        ministry: request.ministry_department,
        event_date: request.pco_event_date || request.goal_review_data?.event_date,
        is_youth_college: request.ministry_department?.toLowerCase().includes('youth') || 
                          request.ministry_department?.toLowerCase().includes('college'),
        need_type: request.goal_review_data?.need_type,
        conversation_so_far: conversationHistory,
        message_count: messageCount
      };

      const prompt = `You are a ministry communications consultant gathering event details. Keep responses brief and move through questions efficiently.

Event: ${context.event_name}
Ministry: ${context.ministry}
Messages exchanged: ${context.message_count}

Conversation:
${context.conversation_so_far}

RULES:
1. Ask ONE question at a time
2. If user gives ANY answer (even vague), acknowledge briefly and move to next question
3. If user says "skip", "not sure", "don't know" - say "No problem" and move on
4. Never ask the same topic more than once
5. Keep responses under 2 sentences

Questions to cover (in order):
1. Event theme
2. Expected attendance (how many people)
3. Materials/items being given to attendees
4. What makes this program special/unique
5. What attendees should leave with (spiritually, emotionally, relationally)
6. Date and time of event
7. Childcare ${context.is_youth_college ? '(Skip for youth/college)' : '(provided/included/alternate)'}
8. Food/menu details
9. Event logistics/flow/speakers/topics
10. Any other specific information

After collecting answers (even partial), summarize:

EVENT THEME: [answer or "Not specified"]
EXPECTED ATTENDANCE: [answer or "TBD"]
MATERIALS: [answer or "None specified"]
WHAT MAKES IT SPECIAL: [answer or "To be determined"]
DESIRED IMPACT: [answer or "To be determined"]
DATE/TIME: [answer or "TBD"]
CHILDCARE: [answer or "TBD"]
FOOD: [answer or "TBD"]
EVENT FLOW: [answer or "TBD"]
SPECIAL NOTES: [answer or "None"]

Then say: "Information complete. Ready for project review."

IMPORTANT: 
- If this is message 10+, provide summary and finish
- Accept incomplete answers and move forward
- Never repeat a question`;

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

      const isDone = response.toLowerCase().includes('ready for project review') || 
                     response.toLowerCase().includes('information complete') ||
                     messageCount >= 12; // Force completion after 12 user messages

      let extractedData = {};
      if (isDone) {
        try {
          const extractPrompt = `Extract event details from this conversation. Use "Not specified" or null for missing info:

${conversationHistory}

Return ONLY valid JSON:
{
  "event_theme": "theme or null",
  "expected_attendance": "number or null",
  "materials_for_attendees": "items or null",
  "what_makes_special": "unique aspects or null",
  "desired_impact": "outcomes or null",
  "event_date_time": "date/time or null",
  "childcare_details": "info or null",
  "food_menu": "details or null",
  "event_flow": "logistics or null",
  "special_notes": "additional info or null"
}`;

          const extractedResponse = await base44.integrations.Core.InvokeLLM({
            prompt: extractPrompt,
            response_json_schema: {
              type: "object",
              properties: {
                event_theme: { type: ["string", "null"] },
                expected_attendance: { type: ["string", "null"] },
                materials_for_attendees: { type: ["string", "null"] },
                what_makes_special: { type: ["string", "null"] },
                desired_impact: { type: ["string", "null"] },
                event_date_time: { type: ["string", "null"] },
                childcare_details: { type: ["string", "null"] },
                food_menu: { type: ["string", "null"] },
                event_flow: { type: ["string", "null"] },
                special_notes: { type: ["string", "null"] }
              }
            }
          });

          extractedData = extractedResponse;
        } catch (extractError) {
          console.error('Failed to extract structured data:', extractError);
        }
      }

      await base44.entities.WorkflowRequest.update(requestId, {
        goal_review_data: {
          ...request.goal_review_data,
          chat_history: updatedMessages,
          completed: isDone,
          completed_at: isDone ? new Date().toISOString() : null,
          ...extractedData
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

      toast.success('✅ Interview complete! Your responses have been sent to our communications team.');
      navigate(createPageUrl('WorkflowHub'));
    } catch (error) {
      console.error('Error updating request:', error);
      toast.error('Failed to complete interview');
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
    <div className="h-full bg-gradient-to-br from-slate-50 to-slate-100 overflow-auto">
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
              <span className="font-mono text-xs text-slate-500">{request.request_number}</span>
            </div>
            <h1 className="text-2xl font-semibold text-slate-900 mb-2">{request.title}</h1>
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

        {/* Email Status Card - NEW */}
        {user?.role === 'admin' && (
          <Card className="border-2 border-blue-200 bg-blue-50">
            <CardHeader className="border-b bg-white">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                📧 Email Status
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {request.email_sent ? (
                      <span className="text-green-700">✅ Email sent to: {request.requestor_email}</span>
                    ) : (
                      <span className="text-orange-700">⚠️ No email sent yet</span>
                    )}
                  </p>
                  {request.email_sent_at && (
                    <p className="text-xs text-slate-600">
                      Sent: {format(new Date(request.email_sent_at), 'PPp')}
                    </p>
                  )}
                  {request.email_error && (
                    <p className="text-xs text-red-600">Error: {request.email_error}</p>
                  )}
                </div>
                <Button
                  onClick={handleResendEmail}
                  disabled={sendingEmail}
                  size="sm"
                  variant="outline"
                >
                  {sendingEmail ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      📤 {request.email_sent ? 'Resend' : 'Send'} Email
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Minister Goal Review Section */}
        {request.status === 'minister_goal_review' && (
          <Card className="border border-slate-200 shadow-sm">
            <CardHeader className="border-b bg-slate-50">
              <CardTitle className="flex items-center gap-2 text-lg font-medium">
                <Target className="w-5 h-5 text-slate-700" />
                Communications Intake Interview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {!conversationStarted ? (
                <div className="text-center py-8">
                  <p className="text-slate-600 mb-6">
                    Quick interview to gather project details (5 minutes)
                  </p>
                  <Button
                    onClick={startGoalReview}
                    className="bg-slate-900 hover:bg-slate-800"
                  >
                    Start Interview
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Chat Messages */}
                  <div 
                    ref={chatContainerRef}
                    className="bg-white rounded-lg border border-slate-200 p-4 h-[400px] overflow-y-auto"
                  >
                    <div className="space-y-4">
                      <AnimatePresence>
                        {chatMessages.map((message, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-[75%] rounded-lg px-4 py-2.5 ${
                              message.role === 'user' 
                                ? 'bg-slate-900 text-white' 
                                : 'bg-slate-100 text-slate-900'
                            }`}>
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>

                      {isAIThinking && (
                        <div className="flex justify-start">
                          <div className="bg-slate-100 rounded-lg px-4 py-2.5">
                            <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
                          </div>
                        </div>
                      )}
                      
                      <div ref={messagesEndRef} />
                    </div>
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
                        className="resize-none border-slate-300 focus:border-slate-400"
                        rows={2}
                      />
                      <Button
                        onClick={sendMessage}
                        disabled={!userInput.trim() || isAIThinking}
                        className="bg-slate-900 hover:bg-slate-800"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  {/* Complete Button - UPDATED */}
                  {goalReviewComplete && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border-t border-slate-200 pt-4"
                    >
                      <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                          <div>
                            <p className="font-medium text-slate-900">✅ Interview Complete!</p>
                            <p className="text-sm text-slate-600">Thank you! Your responses have been recorded.</p>
                          </div>
                        </div>
                        <Button
                          onClick={moveToProjectReview}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Submit Intake
                        </Button>
                      </div>
                      
                      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-900">
                          <strong>What's Next:</strong> Our communications team will review your responses and create a detailed project plan. You'll receive updates as tasks are assigned and completed.
                        </p>
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
          <Card className="border border-slate-200">
            <CardHeader className="border-b bg-slate-50">
              <CardTitle className="text-base font-medium">Request Information</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div>
                <p className="text-xs text-slate-500 mb-1">Requestor</p>
                <p className="font-medium text-sm">{request.requestor_name}</p>
                <p className="text-xs text-slate-600">{request.requestor_email}</p>
              </div>

              {request.description && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Description</p>
                  <p className="text-sm text-slate-700">{request.description}</p>
                </div>
              )}

              {request.goal_review_data?.need_type && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Type</p>
                  <Badge variant="outline" className="capitalize">
                    {request.goal_review_data.need_type}
                  </Badge>
                </div>
              )}

              <div>
                <p className="text-xs text-slate-500 mb-1">Created</p>
                <p className="text-xs text-slate-700">
                  {format(new Date(request.created_date), 'PPP p')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Graphics Items */}
          {request.goal_review_data?.graphics_items && Object.keys(request.goal_review_data.graphics_items).length > 0 && (
            <Card className="border border-slate-200">
              <CardHeader className="border-b bg-slate-50">
                <CardTitle className="text-base font-medium">Graphics Requested</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-2">
                  {Object.entries(request.goal_review_data.graphics_items)
                    .filter(([_, value]) => value)
                    .map(([key, _]) => (
                      <div key={key} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                        <span className="text-sm capitalize">{key.replace(/_/g, ' ')}</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Marketing Channels */}
          {request.goal_review_data?.marketing_channels && Object.keys(request.goal_review_data.marketing_channels).length > 0 && (
            <Card className="border border-slate-200">
              <CardHeader className="border-b bg-slate-50">
                <CardTitle className="text-base font-medium">Marketing Channels</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-2">
                  {Object.entries(request.goal_review_data.marketing_channels)
                    .filter(([_, value]) => value)
                    .map(([key, _]) => (
                      <div key={key} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-sm capitalize">{key.replace(/_/g, ' ')}</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Links */}
          {(request.goal_review_data?.graphics_folder_link || request.goal_review_data?.marketing_assets_link) && (
            <Card className="border border-slate-200">
              <CardHeader className="border-b bg-slate-50">
                <CardTitle className="text-base font-medium">Links</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2">
                {request.goal_review_data.graphics_folder_link && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Graphics Folder</p>
                    <a 
                      href={request.goal_review_data.graphics_folder_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline break-all"
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
                      className="text-xs text-blue-600 hover:underline break-all"
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
          <Card className="border border-slate-200">
            <CardHeader className="border-b bg-slate-50">
              <CardTitle className="text-base font-medium">Activity Log</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3">
                {request.conversation_history.map((item, idx) => (
                  <div key={idx} className="flex gap-3 pb-3 border-b last:border-0">
                    <User className="w-4 h-4 text-slate-400 mt-0.5" />
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