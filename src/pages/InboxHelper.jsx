import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { 
  Mail, 
  Inbox, 
  Tag, 
  Clock, 
  AlertCircle,
  Loader2,
  ExternalLink,
  RefreshCw,
  MailX,
  Sparkles,
  ShieldOff
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import AppHeader from "../components/shared/AppHeader";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


const UnsubscribeFinder = () => {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unsubscribing, setUnsubscribing] = useState(null); // email.id
  const [confirmUnsubscribe, setConfirmUnsubscribe] = useState(null); // email object

  useEffect(() => {
    loadSubscriptionEmails();
  }, []);

  const loadSubscriptionEmails = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('getEmailsWithUnsubscribe');
      const subscriptionEmails = response.data.emails.filter(e => e.hasUnsubscribeLink);
      setEmails(subscriptionEmails);
    } catch (error) {
      console.error("Error loading subscription emails:", error);
      toast.error("Failed to load subscription emails.");
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async (email) => {
    setUnsubscribing(email.id);
    try {
      await base44.functions.invoke('unsubscribeFromEmail', {
        emailId: email.id,
        unsubscribeUrl: email.unsubscribeUrl
      });
      toast.success(`Unsubscribed from ${email.fromName || email.from} and archived email.`);
      // Remove from list
      setEmails(prev => prev.filter(e => e.id !== email.id));
    } catch (error) {
      console.error("Error unsubscribing:", error);
      toast.error(`Failed to unsubscribe. ${error.data?.details || ''}`);
    } finally {
      setUnsubscribing(null);
      setConfirmUnsubscribe(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="ml-4 text-slate-600">Finding subscriptions in your inbox...</p>
      </div>
    );
  }

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MailX className="w-6 h-6 text-blue-600" />
          One-Click Unsubscribe
        </CardTitle>
        <p className="text-slate-500 text-sm pt-1">
          Found {emails.length} subscriptions. Reclaim your inbox by unsubscribing from unwanted emails.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {emails.length === 0 ? (
           <div className="text-center py-12">
             <ShieldOff className="mx-auto h-12 w-12 text-slate-400" />
             <h3 className="mt-2 text-sm font-medium text-slate-900">All Clear!</h3>
             <p className="mt-1 text-sm text-slate-500">We couldn't find any subscription emails with unsubscribe links right now.</p>
           </div>
        ) : (
          emails.map((email) => (
            <motion.div
              key={email.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: -50 }}
              className="p-4 bg-white rounded-lg border border-slate-200 hover:shadow-md transition-all flex items-center justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 truncate">{email.fromName || email.from}</p>
                <p className="text-sm text-slate-500 truncate">{email.subject}</p>
                <p className="text-xs text-slate-400 mt-1">
                  Received {formatDistanceToNow(new Date(email.receivedAt), { addSuffix: true })}
                </p>
              </div>
              <Button
                size="sm"
                variant="destructive"
                className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
                onClick={() => setConfirmUnsubscribe(email)}
                disabled={unsubscribing === email.id}
              >
                {unsubscribing === email.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <MailX className="w-4 h-4 mr-2" />
                    Unsubscribe
                  </>
                )}
              </Button>
            </motion.div>
          ))
        )}
      </CardContent>

      {/* Unsubscribe Confirmation Dialog */}
      <AlertDialog open={!!confirmUnsubscribe} onOpenChange={(isOpen) => !isOpen && setConfirmUnsubscribe(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to unsubscribe?</AlertDialogTitle>
            <AlertDialogDescription>
              This will attempt to unsubscribe you from{' '}
              <span className="font-semibold text-slate-800">{confirmUnsubscribe?.fromName || confirmUnsubscribe?.from}</span>
              {' '}and then archive this email. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => handleUnsubscribe(confirmUnsubscribe)}
              className="bg-red-600 hover:bg-red-700"
            >
              Yes, Unsubscribe
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};


export default function InboxHelper() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  if (loading) {
    return (
      <div className="h-full bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }
  
  if (!user?.microsoft_access_token) {
     return (
       <div className="h-full bg-slate-50 flex flex-col items-center justify-center text-center p-8">
         <Inbox className="w-16 h-16 text-slate-300 mb-4" />
         <h2 className="text-2xl font-bold text-slate-800 mb-2">Connect Your Inbox</h2>
         <p className="text-slate-500 mb-6 max-w-md">
           To use the Inbox Helper, you need to connect your Microsoft 365 account. This will allow us to securely access your emails and help you manage them.
         </p>
         <Button onClick={() => window.location.href = '/settings?tab=integrations'}>
           Connect Microsoft Account
         </Button>
       </div>
     )
  }

  return (
    <div className="h-full bg-gradient-to-br from-blue-50 to-cyan-50 overflow-auto pb-24">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <AppHeader
          icon={Inbox}
          title="Inbox Helper"
          description="Your AI-powered inbox assistant."
          iconColor="from-blue-500 to-cyan-500"
        />

        <Tabs defaultValue="unsubscribe" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="unsubscribe">
              <MailX className="w-4 h-4 mr-2" />
              Unsubscribe
            </TabsTrigger>
            <TabsTrigger value="rollup" disabled>
               <Sparkles className="w-4 h-4 mr-2" />
               The Rollup (Coming Soon)
            </TabsTrigger>
          </TabsList>
          <TabsContent value="unsubscribe" className="mt-6">
            <UnsubscribeFinder />
          </TabsContent>
          <TabsContent value="rollup">
            {/* Rollup feature will go here */}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}