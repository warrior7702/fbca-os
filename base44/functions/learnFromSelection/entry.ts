import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

function normalizePattern(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractKeyWords(text) {
  if (!text) return '';
  
  const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'for', 'at', 'to', 'in', 'on', 'of'];
  const normalized = normalizePattern(text);
  const words = normalized.split(' ').filter(w => w.length > 2 && !stopWords.includes(w));
  
  return words.slice(0, 3).join(' ');
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
      resource: resource_name,
      cardholder: selected_cardholder.name,
      pin: selected_cardholder.pin,
      search: search_term
    });

    // FIXED: Create unique pattern based on event AND resource
    const eventPattern = extractKeyWords(event_name);
    const resourcePattern = normalizePattern(resource_name);
    
    // IMPORTANT: Use a composite key to avoid duplicate PINs
    const patternKey = `${eventPattern}|${resourcePattern}`.substring(0, 100);

    console.log('🔍 Pattern key:', patternKey);
    console.log('🔍 Selected PIN:', selected_cardholder.pin);

    // FIXED: Check for existing pattern using composite key
    const existingPatterns = await base44.asServiceRole.entities.SmartSearchPattern.filter({
      event_name_pattern: eventPattern,
      resource_name_pattern: resourcePattern
    });

    console.log(`📊 Found ${existingPatterns.length} existing patterns for this event+resource`);

    // FIXED: Find pattern that matches BOTH event+resource AND the selected PIN
    const existingPattern = existingPatterns.find(p => p.selected_pin === selected_cardholder.pin);

    if (existingPattern) {
      // Update existing pattern - increase confidence
      const newTimesSelected = (existingPattern.times_selected || 1) + 1;
      const newConfidence = Math.min(10, (existingPattern.confidence_score || 1) + 0.5);
      
      await base44.asServiceRole.entities.SmartSearchPattern.update(existingPattern.id, {
        times_selected: newTimesSelected,
        confidence_score: newConfidence,
        last_used: new Date().toISOString(),
        search_term_used: search_term || existingPattern.search_term_used
      });
      
      console.log(`✅ Updated existing pattern - confidence: ${existingPattern.confidence_score} → ${newConfidence}, times: ${existingPattern.times_selected} → ${newTimesSelected}`);
    } else {
      // FIXED: Check if there's a different PIN for this event+resource combo
      if (existingPatterns.length > 0) {
        console.log('⚠️ Different PIN selected for same event+resource:');
        console.log('   Previous PIN:', existingPatterns[0].selected_pin);
        console.log('   New PIN:', selected_cardholder.pin);
        console.log('   Creating separate pattern...');
      }
      
      // Create new pattern with the NEW PIN
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
      
      console.log('✅ Created new pattern with PIN:', selected_cardholder.pin);
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