import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchQuery } = await req.json();
    
    if (!searchQuery || searchQuery.trim().length < 2) {
      return Response.json({ 
        success: false,
        error: 'Search query must be at least 2 characters' 
      }, { status: 400 });
    }

    // Get all meeting notes for the user
    const allNotes = await base44.entities.MeetingNote.filter({
      user_email: user.email
    });

    // Search through transcripts, summaries, and action items
    const searchLower = searchQuery.toLowerCase();
    const results = allNotes.filter(note => {
      // Search in transcript
      if (note.transcript && note.transcript.toLowerCase().includes(searchLower)) {
        return true;
      }
      
      // Search in summary
      if (note.summary && note.summary.toLowerCase().includes(searchLower)) {
        return true;
      }
      
      // Search in key points
      if (note.key_points && note.key_points.some(point => 
        point.toLowerCase().includes(searchLower)
      )) {
        return true;
      }
      
      // Search in action items
      if (note.action_items && note.action_items.some(item => {
        const itemText = typeof item === 'string' ? item : item.task;
        return itemText.toLowerCase().includes(searchLower);
      })) {
        return true;
      }
      
      // Search in meeting subject
      if (note.meeting_subject && note.meeting_subject.toLowerCase().includes(searchLower)) {
        return true;
      }
      
      return false;
    });

    // Sort by relevance and date
    const sortedResults = results.map(note => {
      let relevanceScore = 0;
      
      // Higher score for matches in title
      if (note.meeting_subject?.toLowerCase().includes(searchLower)) {
        relevanceScore += 10;
      }
      
      // Medium score for matches in summary
      if (note.summary?.toLowerCase().includes(searchLower)) {
        relevanceScore += 5;
      }
      
      // Count occurrences in transcript
      if (note.transcript) {
        const matches = (note.transcript.toLowerCase().match(new RegExp(searchLower, 'g')) || []).length;
        relevanceScore += matches;
      }
      
      return { ...note, relevanceScore };
    }).sort((a, b) => {
      // First by relevance, then by date
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      return new Date(b.meeting_date) - new Date(a.meeting_date);
    });

    return Response.json({
      success: true,
      results: sortedResults,
      count: sortedResults.length,
      query: searchQuery
    });

  } catch (error) {
    console.error('Search error:', error);
    return Response.json({ 
      success: false,
      error: error.message || 'Failed to search meeting transcripts'
    }, { status: 500 });
  }
});