import { AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ConnectionWarning() {
  return (
    <Alert className="border-yellow-300 bg-yellow-50">
      <AlertCircle className="h-4 w-4 text-yellow-600" />
      <AlertDescription className="text-slate-700">
        Some integrations are not connected.{" "}
        <Link 
          to={createPageUrl("Settings") + "?tab=integrations"} 
          className="text-blue-600 hover:text-blue-700 font-medium underline"
        >
          Connect them in Settings
        </Link>
      </AlertDescription>
    </Alert>
  );
}