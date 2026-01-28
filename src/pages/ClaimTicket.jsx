import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ClaimTicket() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const ticketId = searchParams.get('id');
  
  const [status, setStatus] = useState('claiming'); // claiming | success | error
  const [message, setMessage] = useState('');
  const [ticketNumber, setTicketNumber] = useState('');

  useEffect(() => {
    if (!ticketId) {
      setStatus('error');
      setMessage('No ticket ID provided');
      return;
    }

    claimTicket();
  }, [ticketId]);

  const claimTicket = async () => {
    try {
      const response = await base44.functions.invoke('claimTicket', {
        ticket_id: ticketId
      });

      if (response.data.success) {
        // Get ticket number
        const ticket = await base44.entities.Ticket.get(ticketId);
        setTicketNumber(ticket.ticket_number);
        setStatus('success');
        setMessage(`Ticket assigned to ${response.data.assigned_to_name}`);
        
        // Redirect to ticket detail after 2 seconds
        setTimeout(() => {
          navigate(createPageUrl('TicketDetail') + `?id=${ticketId}`);
        }, 2000);
      } else {
        setStatus('error');
        setMessage(response.data.error || 'Failed to claim ticket');
      }
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'Failed to claim ticket');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-50 flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center">
          {status === 'claiming' && (
            <>
              <Loader2 className="w-16 h-16 text-amber-600 mx-auto mb-4 animate-spin" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Claiming Ticket...
              </h2>
              <p className="text-slate-600">
                Assigning ticket to you
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Ticket Claimed!
              </h2>
              {ticketNumber && (
                <p className="text-lg font-semibold text-amber-600 mb-2">
                  {ticketNumber}
                </p>
              )}
              <p className="text-slate-600 mb-4">
                {message}
              </p>
              <p className="text-sm text-slate-500">
                Redirecting to ticket details...
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Failed to Claim
              </h2>
              <p className="text-slate-600 mb-6">
                {message}
              </p>
              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => navigate(createPageUrl('SupportTickets'))}
                >
                  Back to Tickets
                </Button>
                {ticketId && (
                  <Button
                    onClick={() => navigate(createPageUrl('TicketDetail') + `?id=${ticketId}`)}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    View Ticket
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}