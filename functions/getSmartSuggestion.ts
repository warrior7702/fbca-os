import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// Normalize text for pattern matching
function normalizePattern(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
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

// Calculate similarity between two strings (simple word overlap)
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

    console.log('🧠 Getting smart suggestion for:', event_name);

    // Extract patterns from current request
    const eventPattern = extractKeyWords(event_name);
    const resourcePattern = normalizePattern(resource_name);
    const allText = normalizePattern([
      event_name,
      resource_name,
      ...(answers || []).map(a => `${a.question} ${a.answer}`)
    ].join(' '));

    console.log('🔍 Event pattern:', eventPattern);

    // Get all learned patterns
    const learnedPatterns = await base44.asServiceRole.entities.SmartSearchPattern.list('-confidence_score', 100);

    console.log('📚 Found', learnedPatterns.length, 'learned patterns');

    // Find best matching pattern
    let bestMatch = null;
    let bestScore = 0;

    for (const pattern of learnedPatterns) {
      // Calculate similarity score
      const eventSimilarity = calculateSimilarity(eventPattern, pattern.event_name_pattern || '');
      const resourceSimilarity = resourcePattern && pattern.resource_name_pattern 
        ? calculateSimilarity(resourcePattern, pattern.resource_name_pattern)
        : 0;
      
      // Weighted score: event pattern is more important
      const totalScore = (eventSimilarity * 0.7) + (resourceSimilarity * 0.3);
      const finalScore = totalScore * (pattern.confidence_score || 1);

      if (finalScore > bestScore && finalScore > 0.3) { // Minimum 30% similarity
        bestScore = finalScore;
        bestMatch = pattern;
      }
    }

    if (bestMatch) {
      console.log('✅ Found learned pattern match!');
      console.log('   Pattern:', bestMatch.event_name_pattern);
      console.log('   Suggests:', bestMatch.selected_cardholder_name);
      console.log('   Confidence:', bestMatch.confidence_score);
      console.log('   Times used:', bestMatch.times_selected);
      console.log('   Match score:', bestScore.toFixed(2));

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
          reason: `learned from ${bestMatch.times_selected} similar event${bestMatch.times_selected > 1 ? 's' : ''}`,
          confidence: bestMatch.confidence_score,
          match_score: bestScore
        }
      });
    }

    // Fallback to rule-based suggestions
    console.log('📍 No learned pattern - using rule-based suggestion');

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

    // Look for keywords
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