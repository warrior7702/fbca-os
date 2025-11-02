import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Check authentication
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { request_id, resource_id, badge_code } = await req.json();

    if (!request_id || !resource_id) {
      return Response.json({ error: 'request_id and resource_id required' }, { status: 400 });
    }
    if (!badge_code) {
      return Response.json({ error: 'badge_code required' }, { status: 400 });
    }

    // Get user's PCO token
    if (!user.pco_access_token) {
      return Response.json({ 
        error: 'PCO not connected' 
      }, { status: 401 });
    }

    console.log('📝 Attempting to write badge code via delete + recreate');
    console.log('Request ID:', request_id);
    console.log('Resource ID:', resource_id);
    console.log('Badge Code:', badge_code);

    // Step 1: Get the resource questions for this resource
    const questionsUrl = `https://api.planningcenteronline.com/calendar/v2/resources/${resource_id}/resource_questions`;
    const questionsResponse = await fetch(questionsUrl, {
      headers: { 'Authorization': `Bearer ${user.pco_access_token}` }
    });

    if (!questionsResponse.ok) {
      return Response.json({
        ok: false,
        error: 'Failed to fetch resource questions',
        status: questionsResponse.status
      }, { status: questionsResponse.status });
    }

    const questionsData = await questionsResponse.json();
    
    // Find the "badge or code" question
    const badgeQuestion = questionsData.data?.find(q => 
      q.attributes?.question?.toLowerCase().includes('badge') ||
      q.attributes?.question?.toLowerCase().includes('code')
    );

    if (!badgeQuestion) {
      return Response.json({
        ok: false,
        error: 'Could not find badge/code question for this resource'
      }, { status: 404 });
    }

    console.log('✅ Found badge question:', badgeQuestion.id, '-', badgeQuestion.attributes?.question);

    // Step 2: Check if an answer already exists for this question and DELETE it
    const existingAnswersUrl = `https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${request_id}/answers`;
    const existingAnswersResponse = await fetch(existingAnswersUrl, {
      headers: { 'Authorization': `Bearer ${user.pco_access_token}` }
    });

    if (existingAnswersResponse.ok) {
      const existingAnswersData = await existingAnswersResponse.json();
      const existingAnswer = existingAnswersData.data?.find(a => 
        a.relationships?.resource_question?.data?.id === badgeQuestion.id
      );
      
      if (existingAnswer) {
        console.log('🗑️ Deleting existing answer:', existingAnswer.id);
        
        const deleteUrl = `https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${request_id}/answers/${existingAnswer.id}`;
        const deleteResponse = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${user.pco_access_token}` }
        });
        
        if (deleteResponse.ok) {
          console.log('✅ Deleted existing answer');
        } else {
          console.log('⚠️ Could not delete existing answer, will try to create anyway');
        }
      }
    }

    // Step 3: Create new answer
    const createUrl = `https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${request_id}/answers`;
    
    const createPayload = {
      data: {
        type: 'Answer',
        attributes: {
          answer_text: badge_code
        },
        relationships: {
          resource_question: {
            data: {
              type: 'ResourceQuestion',
              id: badgeQuestion.id
            }
          }
        }
      }
    };

    console.log('📤 Creating new answer:', JSON.stringify(createPayload, null, 2));

    const answerResponse = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.pco_access_token}`
      },
      body: JSON.stringify(createPayload)
    });

    const responseText = await answerResponse.text();
    console.log('📥 PCO Response Status:', answerResponse.status);
    console.log('📥 PCO Response:', responseText);

    if (!answerResponse.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { raw: responseText };
      }

      return Response.json({
        ok: false,
        error: 'Failed to create answer',
        status: answerResponse.status,
        details: errorData
      }, { status: answerResponse.status });
    }

    const result = responseText ? JSON.parse(responseText) : { success: true };

    return Response.json({
      ok: true,
      request_id,
      question_id: badgeQuestion.id,
      question: badgeQuestion.attributes?.question,
      answer: badge_code,
      result
    });

  } catch (error) {
    console.error('writePCONote error:', error);
    return Response.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 });
  }
});