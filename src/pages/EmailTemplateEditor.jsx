import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Eye, Code, Send, Copy, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function EmailTemplateEditor() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testEmail, setTestEmail] = useState("");

  // Sample data for preview
  const [previewData, setPreviewData] = useState({
    requester_name: "John Smith",
    project_name: "Youth Ministry Retreat 2024",
    ministry: "Youth Ministry",
    request_number: "CR-123456",
    event_date: "March 15, 2024",
    intake_link: "https://fbca-unified-hub-37662cca.base44.app/workflowdetail?id=sample"
  });

  const [emailTemplate, setEmailTemplate] = useState(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Communications Intake Request</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f7f8fa; line-height: 1.6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f7f8fa;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <!-- Main Container -->
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">
          
          <!-- Header with Gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%); padding: 40px 30px; text-align: center;">
              <div style="background-color: rgba(255, 255, 255, 0.15); width: 80px; height: 80px; margin: 0 auto 20px; border-radius: 20px; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 40px;">📋</span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Communications Request</h1>
              <p style="margin: 10px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">Action Required</p>
            </td>
          </tr>
          
          <!-- Welcome Message -->
          <tr>
            <td style="padding: 40px 30px 30px;">
              <p style="margin: 0 0 20px; color: #1e293b; font-size: 16px; line-height: 1.6;">
                Hi <strong>{{requester_name}}</strong>,
              </p>
              <p style="margin: 0 0 30px; color: #475569; font-size: 15px; line-height: 1.6;">
                Thank you for requesting communications support! We're excited to help you create an amazing experience.
              </p>
              
              <!-- Request Details Card -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border-radius: 12px; padding: 24px; margin-bottom: 30px;">
                <tr>
                  <td>
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">📅 Project</span>
                          <p style="margin: 4px 0 0; color: #1e293b; font-size: 16px; font-weight: 600;">{{project_name}}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">🏢 Ministry</span>
                          <p style="margin: 4px 0 0; color: #1e293b; font-size: 16px; font-weight: 600;">{{ministry}}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">📋 Request #</span>
                          <p style="margin: 4px 0 0; color: #1e293b; font-size: 16px; font-weight: 600; font-family: 'Courier New', monospace;">{{request_number}}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Next Step Section -->
              <div style="background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%); border-radius: 12px; padding: 30px; margin-bottom: 30px; text-align: center;">
                <h2 style="margin: 0 0 12px; color: #ffffff; font-size: 20px; font-weight: 700;">✨ Next Step: Complete Your AI-Powered Intake</h2>
                <p style="margin: 0 0 24px; color: rgba(255, 255, 255, 0.95); font-size: 14px; line-height: 1.6;">
                  We've streamlined our process with a quick 5-minute AI interview that will gather all the details we need to create the perfect communications plan.
                </p>
                <a href="{{intake_link}}" style="display: inline-block; background-color: #ffffff; color: #7c3aed; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);">
                  Start Your Intake Interview →
                </a>
              </div>
              
              <!-- What to Expect -->
              <div style="margin-bottom: 30px;">
                <h3 style="margin: 0 0 16px; color: #1e293b; font-size: 17px; font-weight: 700;">What to expect:</h3>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; vertical-align: top;">
                      <span style="color: #22c55e; font-size: 18px; margin-right: 12px;">✓</span>
                      <span style="color: #475569; font-size: 14px;">Quick Q&A about your event (5 minutes)</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; vertical-align: top;">
                      <span style="color: #22c55e; font-size: 18px; margin-right: 12px;">✓</span>
                      <span style="color: #475569; font-size: 14px;">Questions about theme, audience, goals, and logistics</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; vertical-align: top;">
                      <span style="color: #22c55e; font-size: 18px; margin-right: 12px;">✓</span>
                      <span style="color: #475569; font-size: 14px;">No need to prepare - just answer naturally</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; vertical-align: top;">
                      <span style="color: #22c55e; font-size: 18px; margin-right: 12px;">✓</span>
                      <span style="color: #475569; font-size: 14px;">You can skip questions if unsure</span>
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- After Completion -->
              <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                <h3 style="margin: 0 0 12px; color: #166534; font-size: 16px; font-weight: 700;">After you complete the intake:</h3>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 6px 0; vertical-align: top;">
                      <span style="color: #22c55e; font-size: 16px; margin-right: 10px;">✅</span>
                      <span style="color: #166534; font-size: 14px;">Our communications team will review your responses</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; vertical-align: top;">
                      <span style="color: #22c55e; font-size: 16px; margin-right: 10px;">✅</span>
                      <span style="color: #166534; font-size: 14px;">We'll create a detailed project plan</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; vertical-align: top;">
                      <span style="color: #22c55e; font-size: 16px; margin-right: 10px;">✅</span>
                      <span style="color: #166534; font-size: 14px;">Tasks will be assigned to our design & marketing team</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; vertical-align: top;">
                      <span style="color: #22c55e; font-size: 16px; margin-right: 10px;">✅</span>
                      <span style="color: #166534; font-size: 14px;">You'll be able to track progress in real-time</span>
                    </td>
                  </tr>
                </table>
              </div>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 8px; color: #64748b; font-size: 14px;">
                Questions? Contact us at
              </p>
              <p style="margin: 0 0 20px;">
                <a href="mailto:communications@fbcarlington.org" style="color: #7c3aed; text-decoration: none; font-weight: 600; font-size: 15px;">
                  📧 communications@fbcarlington.org
                </a>
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 13px; line-height: 1.5;">
                Looking forward to making your project a success!<br>
                <strong style="color: #64748b;">— Communications Team, FBC Arlington</strong>
              </p>
            </td>
          </tr>
          
        </table>
        
        <!-- Unsubscribe Footer -->
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; margin-top: 20px;">
          <tr>
            <td style="text-align: center; padding: 0 20px;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                This is an automated notification from FBC Arlington Communications Team.
              </p>
            </td>
          </tr>
        </table>
        
      </td>
    </tr>
  </table>
</body>
</html>`);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setTestEmail(currentUser.email);
    } catch (error) {
      console.error("Error loading user:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderPreview = () => {
    let html = emailTemplate;
    
    // Replace placeholders with preview data
    Object.entries(previewData).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      html = html.replaceAll(placeholder, value);
    });
    
    return html;
  };

  const handleCopyTemplate = () => {
    navigator.clipboard.writeText(emailTemplate);
    setCopied(true);
    toast.success("Template copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendTest = async () => {
    if (!testEmail) {
      toast.error("Please enter an email address");
      return;
    }

    setSending(true);
    try {
      const html = renderPreview();
      
      await base44.integrations.Core.SendEmail({
        from_name: 'FBC Arlington Communications',
        to: testEmail,
        subject: `📋 TEST: Communications Intake Email Template`,
        body: html
      });

      toast.success(`Test email sent to ${testEmail}!`);
    } catch (error) {
      console.error("Error sending test email:", error);
      toast.error("Failed to send test email");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-br from-purple-50 to-pink-50 overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl shadow-lg">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Email Template Editor</h1>
              <p className="text-slate-600">Preview and customize the communications intake email</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleCopyTemplate} variant="outline">
              {copied ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Template
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Preview Data Editor */}
        <Card className="border-2 border-blue-200">
          <CardHeader className="bg-blue-50 border-b">
            <CardTitle className="text-base">Preview Data (for testing only)</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Requester Name</Label>
                <Input
                  value={previewData.requester_name}
                  onChange={(e) => setPreviewData(prev => ({ ...prev, requester_name: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Project Name</Label>
                <Input
                  value={previewData.project_name}
                  onChange={(e) => setPreviewData(prev => ({ ...prev, project_name: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Ministry</Label>
                <Input
                  value={previewData.ministry}
                  onChange={(e) => setPreviewData(prev => ({ ...prev, ministry: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Request Number</Label>
                <Input
                  value={previewData.request_number}
                  onChange={(e) => setPreviewData(prev => ({ ...prev, request_number: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Editor */}
        <Tabs defaultValue="preview" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="code" className="flex items-center gap-2">
              <Code className="w-4 h-4" />
              Edit HTML
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="mt-6">
            <Card className="border-2 border-slate-200">
              <CardHeader className="bg-slate-50 border-b">
                <CardTitle className="text-base">Email Preview</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="bg-slate-100 p-6 overflow-auto" style={{ maxHeight: '70vh' }}>
                  <div 
                    dangerouslySetInnerHTML={{ __html: renderPreview() }}
                    className="bg-white"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="code" className="mt-6">
            <Card className="border-2 border-slate-200">
              <CardHeader className="bg-slate-50 border-b">
                <CardTitle className="text-base">HTML Template</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <Textarea
                  value={emailTemplate}
                  onChange={(e) => setEmailTemplate(e.target.value)}
                  className="font-mono text-xs h-[60vh] resize-none"
                  placeholder="Edit HTML template..."
                />
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-900 font-semibold mb-2">🔧 Template Variables:</p>
                  <div className="text-xs text-blue-800 space-y-1 font-mono">
                    <p>• <code>{'{{requester_name}}'}</code> - Person's name</p>
                    <p>• <code>{'{{project_name}}'}</code> - Event or project name</p>
                    <p>• <code>{'{{ministry}}'}</code> - Ministry department</p>
                    <p>• <code>{'{{request_number}}'}</code> - Request ID (e.g., CR-123456)</p>
                    <p>• <code>{'{{intake_link}}'}</code> - Link to intake form</p>
                    <p>• <code>{'{{event_date}}'}</code> - Formatted event date</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Test Email Section */}
        <Card className="border-2 border-green-200 bg-green-50">
          <CardHeader className="bg-white border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="w-5 h-5 text-green-600" />
              Send Test Email
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="text-xs mb-1 block">Test Email Address</Label>
                <Input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="h-10"
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleSendTest}
                  disabled={sending}
                  className="bg-green-600 hover:bg-green-700 h-10"
                >
                  {sending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Test
                    </>
                  )}
                </Button>
              </div>
            </div>
            <p className="text-xs text-green-700 mt-2">
              ℹ️ This will send a test email with the current template and preview data
            </p>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="border-2 border-slate-200">
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="text-base">💡 How to Use</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <ol className="text-sm text-slate-700 space-y-2 list-decimal list-inside">
              <li>Edit the HTML template in the "Edit HTML" tab</li>
              <li>Use template variables like <code className="bg-slate-100 px-1 rounded">{'{{requester_name}}'}</code> for dynamic content</li>
              <li>Preview your changes in the "Preview" tab</li>
              <li>Send a test email to see how it looks in your inbox</li>
              <li>Copy the template and paste it into your functions/form code</li>
            </ol>
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-800">
                <strong>⚠️ Note:</strong> Changes made here are for preview only. To apply them to your app, copy the template and paste it into:
              </p>
              <ul className="text-xs text-yellow-700 mt-2 ml-4 list-disc">
                <li><code>functions/monitorMysteryResource</code> (line ~200)</li>
                <li><code>pages/CommunicationsRequestForm.js</code> (line ~650)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}