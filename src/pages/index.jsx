import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to Loading page on app start
    navigate(createPageUrl("Loading"));
  }, [navigate]);

  return null;
}