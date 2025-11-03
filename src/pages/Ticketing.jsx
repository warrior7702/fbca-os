import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Ticketing() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to new Support Tickets page
    navigate(createPageUrl("SupportTickets"), { replace: true });
  }, []);

  return null;
}