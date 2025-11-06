import { createClientFromRequest } from "npm:@base44/sdk@0.7.1";

Deno.serve(async (req) => {
  const diag = [];
  
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();

    if (!currentUser) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { request_id, event_id, resource_id } = await req.json();
    
    diag.push({ step: "input", request_id, event_id, resource_id });

    // Get PCO token (handles refresh automatically)
    let token;
    try {
      const tokenResponse = await base44.functions.invoke("getPCOToken");
      if (!tokenResponse.data?.ok) {
        throw new Error(tokenResponse.data?.error || 'Failed to get token');
      }
      token = tokenResponse.data.access_token;
      diag.push({ step: "token-obtained", has_token: !!token });
    } catch (error) {
      console.error('Token fetch error:', error);
      diag.push({ step: "token-error", error: String(error) });
      return Response.json({ 
        ok: false, 
        error: 'Failed to get PCO token: ' + error.message,
        diag 
      }, { status: 500 });
    }

    const headers = { 
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json" 
    };

    async function pcoGet(url) {
      const r = await fetch(url, { headers });
      const text = await r.text();
      let json;
      try { 
        json = text ? JSON.parse(text) : {}; 
      } catch { 
        json = { non_json: true, body: text }; 
      }
      if (!r.ok) {
        console.error(`PCO API Error: GET ${url} returned ${r.status}`);
        console.error('Response:', text);
        throw new Error(`GET ${url} :: ${r.status} :: ${text.slice(0, 200)}`);
      }
      return json;
    }

    // 1) Pull the resource questions (for labels)
    let questions = [];
    try {
      const q = await pcoGet(`https://api.planningcenteronline.com/calendar/v2/resources/${resource_id}/resource_questions`);
      questions = (q.data || []).map(q => ({
        id: q.id,
        question: q.attributes?.question,
        description: q.attributes?.description,
        kind: q.attributes?.kind,
        choices: q.attributes?.choices,
        multiple_select: q.attributes?.multiple_select,
        optional: q.attributes?.optional
      }));
      diag.push({ step: "questions", count: questions.length });
    } catch (e) {
      console.error('Questions fetch error:', e);
      diag.push({ step: "questions-error", error: String(e) });
    }

    // 2) Get answers from the request's /answers endpoint
    const answers = {};
    
    if (request_id) {
      try {
        diag.push({ step: "fetching-answers", url: `/event_resource_requests/${request_id}/answers` });
        
        const answersUrl = `https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${request_id}/answers`;
        const answersJson = await pcoGet(answersUrl);
        
        const answerObjects = Array.isArray(answersJson.data) ? answersJson.data : [];
        diag.push({ step: "answers-fetched", count: answerObjects.length });

        for (const a of answerObjects) {
          const questionId = a.relationships?.resource_question?.data?.id;
          
          if (!questionId) {
            diag.push({ warning: "Answer has no question relationship", answer_id: a.id });
            continue;
          }
          
          // Extract the answer value
          let value = 
            a.attributes?.answer_text ||
            a.attributes?.answer ||
            a.attributes?.value ||
            a.attributes?.answer_number ||
            a.attributes?.answer_boolean ||
            a.attributes?.answer_choice;
          
          // Handle boolean display
          if (typeof value === 'boolean') {
            value = value ? 'Yes' : 'No';
          }
          
          // Handle numbers
          if (typeof value === 'number') {
            value = String(value);
          }
          
          if (value !== null && value !== undefined && value !== '') {
            answers[questionId] = String(value);
            diag.push({ 
              step: "answer-mapped", 
              question_id: questionId, 
              value: String(value).substring(0, 100) 
            });
          }
        }
        
        diag.push({ step: "answers-final", found: Object.keys(answers).length });
      } catch (e) {
        console.error('Answers fetch error:', e);
        diag.push({ step: "answers-error", error: String(e) });
      }
    }

    // 3) Event summary
    let event = null;
    try {
      const eJson = await pcoGet(`https://api.planningcenteronline.com/calendar/v2/events/${event_id}`);
      event = {
        id: eJson.data?.id,
        name: eJson.data?.attributes?.name,
        starts_at: eJson.data?.attributes?.starts_at,
        ends_at: eJson.data?.attributes?.ends_at,
        percent_approved: eJson.data?.attributes?.percent_approved,
        approval_status: eJson.data?.attributes?.approval_status
      };
      diag.push({ step: "event", ok: true });
    } catch (e) {
      console.error('Event fetch error:', e);
      diag.push({ step: "event-error", error: String(e) });
    }

    return Response.json({
      ok: true,
      event,
      questions,
      answers,
      totals: { questions: questions.length, answers: Object.keys(answers).length },
      diag
    });
  } catch (err) {
    console.error('getApprovalDetails error:', err);
    return Response.json({ 
      ok: false, 
      error: String(err), 
      diag 
    }, { status: 500 });
  }
});