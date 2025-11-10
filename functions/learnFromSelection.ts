import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// Normalize text for pattern matching
function normalizePattern(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove special chars
    .replace(/\s+/g, ' ') // Collapse spaces
    .trim();
}

// Extract key words from event name
function extractKeyWords(text) {
  if (!text) return '';
  
  const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'for', 'at', 'to', 'in', 'on', 'of'];
  const normalized = normalizePattern(text);
  const words = normalized.split(' ').filter(w => w.length > 2 && !stopWords.includes(w));
  
  return words.slice(0, 3).join(' '); // Top 3 keywords
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { 
      event_name, 
      resource_name, 
      selected_cardholder,
      search_term 
    } = body;

    if (!event_name || !selected_cardholder) {
      return Response.json({ 
        error: 'event_name and selected_cardholder required' 
      }, { status: 400 });
    }

    console.log('📚 Learning from selection:', {
      event: event_name,
      cardholder: selected_cardholder.name,
      search: search_term
    });

    // Create patterns
    const eventPattern = extractKeyWords(event_name);
    const resourcePattern = normalizePattern(resource_name);

    console.log('🔍 Extracted patterns:', { eventPattern, resourcePattern });

    // Check if this pattern already exists
    const existingPatterns = await base44.asServiceRole.entities.SmartSearchPattern.filter({
      event_name_pattern: eventPattern,
      selected_pin: selected_cardholder.pin
    });

    if (existingPatterns.length > 0) {
      // Update existing pattern - increase confidence
      const pattern = existingPatterns[0];
      await base44.asServiceRole.entities.SmartSearchPattern.update(pattern.id, {
        times_selected: (pattern.times_selected || 1) + 1,
        confidence_score: Math.min(10, (pattern.confidence_score || 1) + 0.5),
        last_used: new Date().toISOString(),
        search_term_used: search_term || pattern.search_term_used
      });
      
      console.log('✅ Updated existing pattern - confidence now:', pattern.confidence_score + 0.5);
    } else {
      // Create new pattern
      await base44.asServiceRole.entities.SmartSearchPattern.create({
        event_name_pattern: eventPattern,
        resource_name_pattern: resourcePattern,
        selected_cardholder_name: selected_cardholder.name,
        selected_pin: selected_cardholder.pin,
        selected_member_id: selected_cardholder.member_id || null,
        search_term_used: search_term || eventPattern,
        confidence_score: 1,
        times_selected: 1,
        last_used: new Date().toISOString()
      });
      
      console.log('✅ Created new pattern');
    }

    return Response.json({ 
      ok: true,
      message: 'Pattern learned successfully'
    });

  } catch (error) {
    console.error('❌ Learn error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});