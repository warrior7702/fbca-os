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

function calculateSimilarity(str1, str2) {
  const words1 = new Set(str1.split(' '));
  const words2 = new Set(str2.split(' '));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { event_name, resource_name, answers } = body;

    if (!event_name) {
      return Response.json({ 
        error: 'event_name required' 
      }, { status: 400 });
    }

    console.log('========================================');
    console.log('🧠 SMART SUGGESTION REQUEST');
    console.log('Event:', event_name);
    console.log('Resource:', resource_name);
    console.log('========================================');

    // Extract patterns from current request
    const eventPattern = extractKeyWords(event_name);
    const resourcePattern = normalizePattern(resource_name);
    const allText = normalizePattern([
      event_name,
      resource_name,
      ...(answers || []).map(a => `${a.question} ${a.answer}`)
    ].join(' '));

    console.log('🔍 Event pattern:', eventPattern);
    console.log('🔍 Resource pattern:', resourcePattern);

    // Get learned patterns for this EXACT event+resource combo
    const learnedPatterns = await base44.asServiceRole.entities.SmartSearchPattern.filter({
      event_name_pattern: eventPattern,
      resource_name_pattern: resourcePattern
    });

    console.log(`📚 Found ${learnedPatterns.length} learned patterns for this EXACT event+resource`);

    if (learnedPatterns.length > 0) {
      // Sort by confidence and times used
      learnedPatterns.sort((a, b) => {
        const scoreA = (a.confidence_score || 1) * (a.times_selected || 1);
        const scoreB = (b.confidence_score || 1) * (b.times_selected || 1);
        return scoreB - scoreA;
      });

      const bestMatch = learnedPatterns[0];

      console.log('========================================');
      console.log('✅ EXACT MATCH FOUND!');
      console.log('Pattern:', bestMatch.event_name_pattern);
      console.log('Resource:', bestMatch.resource_name_pattern);
      console.log('→ Cardholder:', bestMatch.selected_cardholder_name);
      console.log('→ PIN:', bestMatch.selected_pin);
      console.log('→ Confidence:', bestMatch.confidence_score);
      console.log('→ Times used:', bestMatch.times_selected);
      console.log('========================================');

      return Response.json({
        ok: true,
        learned: true,
        suggestion: {
          search: bestMatch.search_term_used || bestMatch.selected_cardholder_name,
          cardholder: {
            name: bestMatch.selected_cardholder_name,
            pin: bestMatch.selected_pin,
            member_id: bestMatch.selected_member_id
          },
          reason: `learned from ${bestMatch.times_selected} previous selection${bestMatch.times_selected > 1 ? 's' : ''}`,
          confidence: bestMatch.confidence_score,
          match_score: 1.0 // Perfect match
        }
      });
    }

    // No exact match - try fuzzy matching on event name only
    console.log('🔍 No exact match - trying fuzzy event name matching...');
    
    const allPatterns = await base44.asServiceRole.entities.SmartSearchPattern.list('-confidence_score', 100);
    console.log(`📚 Checking ${allPatterns.length} total learned patterns`);

    let bestFuzzyMatch = null;
    let bestFuzzyScore = 0;

    for (const pattern of allPatterns) {
      const eventSimilarity = calculateSimilarity(eventPattern, pattern.event_name_pattern || '');
      const resourceSimilarity = resourcePattern && pattern.resource_name_pattern 
        ? calculateSimilarity(resourcePattern, pattern.resource_name_pattern)
        : 0;
      
      // Weighted: event 80%, resource 20%
      const totalScore = (eventSimilarity * 0.8) + (resourceSimilarity * 0.2);
      const finalScore = totalScore * (pattern.confidence_score || 1);

      if (finalScore > bestFuzzyScore && finalScore > 0.4) { // 40% threshold
        bestFuzzyScore = finalScore;
        bestFuzzyMatch = pattern;
      }
    }

    if (bestFuzzyMatch) {
      console.log('========================================');
      console.log('✅ FUZZY MATCH FOUND');
      console.log('Pattern:', bestFuzzyMatch.event_name_pattern);
      console.log('→ Cardholder:', bestFuzzyMatch.selected_cardholder_name);
      console.log('→ PIN:', bestFuzzyMatch.selected_pin);
      console.log('→ Match score:', bestFuzzyScore.toFixed(2));
      console.log('========================================');

      return Response.json({
        ok: true,
        learned: true,
        suggestion: {
          search: bestFuzzyMatch.search_term_used || bestFuzzyMatch.selected_cardholder_name,
          cardholder: {
            name: bestFuzzyMatch.selected_cardholder_name,
            pin: bestFuzzyMatch.selected_pin,
            member_id: bestFuzzyMatch.selected_member_id
          },
          reason: `similar to ${bestFuzzyMatch.times_selected} previous event${bestFuzzyMatch.times_selected > 1 ? 's' : ''}`,
          confidence: bestFuzzyMatch.confidence_score,
          match_score: bestFuzzyScore
        }
      });
    }

    // Fallback to rule-based suggestions
    console.log('📍 No learned patterns - using rule-based suggestion');

    // Look for explicit 6-digit code
    const codeMatch = allText.match(/\b(\d{6})\b/);
    if (codeMatch) {
      return Response.json({
        ok: true,
        learned: false,
        suggestion: {
          code: codeMatch[1],
          reason: 'found in event details'
        }
      });
    }

    // NEW: Use event name as search term
    const eventWords = eventPattern.split(' ')[0]; // First keyword
    if (eventWords) {
      console.log('💡 Suggesting event-based search:', eventWords);
      return Response.json({
        ok: true,
        learned: false,
        suggestion: {
          search: eventWords,
          reason: 'event name keyword'
        }
      });
    }

    // Keyword fallbacks
    const buildingKeywords = {
      'unlock': { search: 'unlock', reason: 'unlock keyword detected' },
      'pcb': { search: 'PCB', reason: 'PCB building detected' },
      'preschool': { search: 'PCB', reason: 'preschool building detected' },
      'fbc': { search: 'FBC', reason: 'FBC building detected' },
      'main building': { search: 'FBC', reason: 'main building detected' },
      'wade': { search: 'WADE', reason: 'Wade Center detected' },
      'sb': { search: 'SB', reason: 'Student Building detected' },
      'sc': { search: 'SB', reason: 'Student Center detected' }
    };

    for (const [keyword, suggestion] of Object.entries(buildingKeywords)) {
      if (allText.includes(keyword)) {
        return Response.json({
          ok: true,
          learned: false,
          suggestion
        });
      }
    }

    // Default
    return Response.json({
      ok: true,
      learned: false,
      suggestion: {
        search: 'unlock',
        reason: 'building access request'
      }
    });

  } catch (error) {
    console.error('❌ Smart suggestion error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});