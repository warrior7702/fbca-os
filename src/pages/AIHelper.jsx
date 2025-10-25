import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  Send, 
  Loader2, 
  FileText, 
  Calendar, 
  Users, 
  Settings,
  Megaphone,
  UtensilsCrossed,
  CheckSquare,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ReactMarkdown from "react-markdown";

const quickActions = [
  { 
    icon: CheckSquare, 
    label: "Show my tasks for today", 
    query: "What are my tasks due today?",
    color: "text-blue-500"
  },
  { 
    icon: Calendar, 
    label: "What's on my calendar?", 
    query: "Show me my upcoming calendar events",
    color: "text-purple-500"
  },
  { 
    icon: Users, 
    label: "Find a staff member", 
    query: "Help me find contact information for a staff member",
    color: "text-teal-500"
  },
  { 
    icon: Megaphone, 
    label: "Marketing help", 
    query: "How do I submit a marketing request?",
    color: "text-pink-500"
  },
  { 
    icon: UtensilsCrossed, 
    label: "Order catering", 
    query: "How do I order catering for an event?",
    color: "text-green-500"
  },
  { 
    icon: Settings, 
    label: "Connect integrations", 
    query: "How do I connect my Planning Center, ClickUp, and Microsoft accounts?",
    color: "text-slate-500"
  }
];

export default function AIHelper() {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      // Add welcome message
      setMessages([{
        role: 'assistant',
        content: `Hello ${currentUser.display_name || currentUser.full_name}! 👋\n\nI'm **The Light**, your AI assistant for FBCA OS. I can help you with:\n\n- Finding information across your apps\n- Answering questions about FBCA systems\n- Guiding you through processes\n- Connecting you with the right people\n\nWhat can I help you with today?`
      }]);
    } catch (error) {
      console.error("Error loading user:", error);
    } finally {
      setInitializing(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleQuickAction = async (query) => {
    setInput("");
    await handleSubmit(query);
  };

  const handleSubmit = async (queryText) => {
    const question = queryText || input;
    if (!question.trim() || loading) return;

    setInput("");
    
    // Add user message
    const userMessage = { role: 'user', content: question };
    setMessages(prev => [...prev, userMessage]);
    
    setLoading(true);

    try {
      // Build context about the app and user
      const appContext = `
You are "The Light", an AI assistant for FBCA OS (First Baptist Church of Conroe Operating System).

Current User: ${user.display_name || user.full_name} (${user.email})
Department: ${user.department || 'Not specified'}
Role: ${user.role_title || 'Staff Member'}

FBCA OS has the following modules:
- Dashboard: Main hub with desktop-style interface
- My Tasks: ClickUp task management with calendar views
- Marketing: Submit and track marketing campaign requests
- Food Service: Catering orders and menu planning
- Staff Directory: Contact information for all FBCA staff
- Documents: Browse OneDrive files and folders
- Settings: Manage profile and connect integrations (Planning Center, ClickUp, Microsoft 365)

Connected Services:
- Planning Center: ${user.pco_access_token ? 'Connected' : 'Not connected'}
- ClickUp: ${user.clickup_access_token ? 'Connected' : 'Not connected'}
- Microsoft 365: ${user.microsoft_access_token ? 'Connected' : 'Not connected'}

Provide helpful, friendly, and concise answers. If the user needs to navigate somewhere, suggest the specific page or module. If they need to connect a service, direct them to Settings > Integrations.
`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `${appContext}\n\nUser Question: ${question}`,
        add_context_from_internet: false
      });

      // Add assistant response
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
      
    } catch (error) {
      console.error("Error getting AI response:", error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "I'm sorry, I encountered an error. Please try again or contact support if the problem persists." 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (initializing) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 mx-auto mb-4"
          >
            <Sparkles className="w-16 h-16 text-yellow-500" />
          </motion.div>
          <p className="text-slate-600">Initializing The Light...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex flex-col">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 p-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full flex items-center justify-center shadow-lg"
          >
            <Sparkles className="w-6 h-6 text-white" />
          </motion.div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">The Light</h1>
            <p className="text-sm text-slate-600">Your AI assistant for FBCA OS</p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Quick Actions - Show only if no messages yet */}
          {messages.length <= 1 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid md:grid-cols-2 gap-3 mb-8"
            >
              {quickActions.map((action, index) => (
                <motion.button
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleQuickAction(action.query)}
                  className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all text-left border border-slate-200"
                >
                  <div className={`p-2 bg-slate-50 rounded-lg ${action.color}`}>
                    <action.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{action.label}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </motion.button>
              ))}
            </motion.div>
          )}

          {/* Messages */}
          <AnimatePresence>
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                  <div className={`rounded-2xl p-4 ${
                    message.role === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white shadow-sm border border-slate-200'
                  }`}>
                    {message.role === 'assistant' ? (
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0 text-slate-700">{children}</p>,
                            ul: ({ children }) => <ul className="my-2 ml-4 list-disc text-slate-700">{children}</ul>,
                            ol: ({ children }) => <ol className="my-2 ml-4 list-decimal text-slate-700">{children}</ol>,
                            li: ({ children }) => <li className="mb-1">{children}</li>,
                            strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                            code: ({ inline, children }) => 
                              inline ? (
                                <code className="px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded text-sm font-mono">
                                  {children}
                                </code>
                              ) : (
                                <code className="block p-2 bg-slate-100 text-slate-800 rounded text-sm font-mono overflow-x-auto">
                                  {children}
                                </code>
                              )
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-white">{message.content}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Loading indicator */}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />
                  <span className="text-slate-600 text-sm">The Light is thinking...</span>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white/80 backdrop-blur-sm border-t border-slate-200 p-4 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask The Light anything..."
              className="flex-1 h-12 text-base"
              disabled={loading}
            />
            <Button 
              type="submit" 
              disabled={loading || !input.trim()}
              className="h-12 px-6 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-slate-900 font-medium shadow-lg"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}