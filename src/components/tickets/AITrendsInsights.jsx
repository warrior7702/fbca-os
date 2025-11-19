import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, TrendingUp, AlertTriangle, CheckCircle2, Lightbulb } from "lucide-react";
import { toast } from "sonner";

export default function AITrendsInsights() {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [stats, setStats] = useState(null);

  const loadTrends = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('analyzeTicketTrends');
      if (response.data.success) {
        setAnalysis(response.data.analysis);
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error loading trends:', error);
      toast.error('Failed to load trend analysis');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrends();
  }, []);

  const getFrequencyColor = (frequency) => {
    const colors = {
      high: 'bg-red-100 text-red-700 border-red-300',
      medium: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      low: 'bg-blue-100 text-blue-700 border-blue-300'
    };
    return colors[frequency] || colors.medium;
  };

  if (loading && !analysis) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-slate-600">Analyzing ticket trends with AI...</p>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) return null;

  return (
    <div className="space-y-4">
      <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-purple-900">
              <Sparkles className="w-5 h-5" />
              AI Trend Analysis
            </CardTitle>
            <Button onClick={loadTrends} variant="outline" size="sm" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            Analyzing {stats?.total_tickets} tickets from the last {stats?.time_period}
          </p>
        </CardContent>
      </Card>

      {/* Recurring Issues */}
      {analysis.recurring_issues && analysis.recurring_issues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Recurring Issues
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analysis.recurring_issues.map((issue, idx) => (
              <div key={idx} className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h4 className="font-semibold text-slate-900">{issue.issue}</h4>
                  <Badge variant="outline" className={getFrequencyColor(issue.frequency)}>
                    {issue.frequency} frequency
                  </Badge>
                </div>
                {issue.affected_categories && issue.affected_categories.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {issue.affected_categories.map((cat, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {cat}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="flex items-start gap-2 mt-2 p-3 bg-blue-50 rounded border-l-4 border-blue-400">
                  <Lightbulb className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-700">{issue.recommendation}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Improvement Areas */}
      {analysis.improvement_areas && analysis.improvement_areas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-900">
              <TrendingUp className="w-5 h-5 text-orange-600" />
              Areas for Improvement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analysis.improvement_areas.map((area, idx) => (
              <div key={idx} className="p-4 bg-slate-50 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-2">{area.area}</h4>
                <p className="text-sm text-slate-600 mb-2">
                  <span className="font-medium">Current:</span> {area.current_state}
                </p>
                <div className="flex items-start gap-2 p-3 bg-green-50 rounded border-l-4 border-green-400">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-700">
                    <span className="font-medium">Action:</span> {area.suggested_action}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Positive Trends */}
      {analysis.positive_trends && analysis.positive_trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-900">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Positive Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analysis.positive_trends.map((trend, idx) => (
                <div key={idx} className="flex items-start gap-2 p-3 bg-green-50 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-700">{trend.trend}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}