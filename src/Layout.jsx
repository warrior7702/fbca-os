import { createClientFromRequest } from "npm:@base44/sdk@0.7.1";

/**
 * getApprovalDetails
 * Returns Planning Center resource questions, answers, and event summary
 * using the current Base44 user’s PCO token. Includes a fallback path that
 * reads answers from event resource bookings when request answers are empty.
 *
 * Input JSON: { request_id, event_id, resource_id }
 * Output JSON: {
 *   ok: true,
 *   event: {...} | null,
 *   questions: [{ id, question, description, kind, ... }],
 *   answers: { [questionId]: string },
 *   totals: { questions, answers },
 *   diag: [ {...steps/logs...} ]
 * }
 */

Deno.serve(async (req) => {
  const diag = [];
  try {
    // Auth (Base44 user)
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    diag.push({ step: "auth", email: user?.email || null, hasPCOToken: !!user?.pco_access_token });

    if (!user?.pco_access_token) {
      return Response.json({ ok: false, error: "Unauthorized: missing pco_access_token", diag }, { status: 401 });
    }

    // Parse input
    const { request_id, event_id, resource_id } = await req.json();
    diag.push({ step: "input", request_id, event_id, resource_id });
    if (!event_id || !resource_id) {
      return Response.json({ ok: false, error: "Missing event_id or resource_id", diag }, { status: 400 });
    }

    const headers = {
      Authorization: `Bearer ${user.pco_access_token}`,
      "Content-Type": "application/json",
    };

    // Small helper
    async function pcoGet(url) {
      const r = await fetch(url, { headers });
      const txt = await r.text();
      let json = {};
      try { json = JSON.parse(txt || "{}"); } catch { /* keep txt for diag */ }
      if (!r.ok) {
        throw new Error(`GET ${url} -> ${r.status} ${(typeof json === "object") ? JSON.stringify(json).slice(0, 800) : txt.slice(0, 800)}`);
      }
      return json;
    }

    // Normalizes any PCO answer variant to a displayable string
    function normalizeAnswer(val) {
      // if an array (multi-select), join
      if (Array.isArray(val)) {
        return val.map((x) => (typeof x === "object" && x?.attributes?.name) ? x.attributes.name : String(x)).join(", ");
      }
      // if object with name
      if (val && typeof val === "object") {
        if (val.attributes?.name) return val.attributes.name;
        // as a last resort stringify
        return JSON.stringify(val);
      }
      // booleans/numbers/strings
      if (val === 0) return "0";
      if (val === false) return "No";
      if (val === true) return "Yes";
      return (val ?? "").toString();
    }

    // 1) Fetch resource questions
    const qUrl = `https://api.planningcenteronline.com/calendar/v2/resources/${resource_id}/resource_questions`;
    let questions = [];
    try {
      const qJson = await pcoGet(qUrl);
      questions = (qJson.data || []).map((q) => ({
        id: q.id,
        question: q.attributes?.question,
        description: q.attributes?.description,
        kind: q.attributes?.kind,
        choices: q.attributes?.choices,
        multiple_select: q.attributes?.multiple_select,
        optional: q.attributes?.optional,
      }));
      diag.push({ step: "questions", count: questions.length });
    } catch (e) {
      diag.push({ step: "questions-error", error: String(e) });
    }

    // 2) Try answers via request-specific endpoint
    const answers = {};
    if (request_id) {
      const aUrl = `https://api.planningcenteronline.com/calendar/v2/event_resource_requests/${request_id}/resource_answers`;
      try {
        const aJson = await pcoGet(aUrl);
        const arr = aJson.data || [];
        diag.push({ step: "answers-request", count: arr.length });

        for (const a of arr) {
          const qid = a?.relationships?.resource_question?.data?.id;
          if (!qid) continue;
          const raw =
            a?.attributes?.answer_text ??
            a?.attributes?.answer_number ??
            a?.attributes?.answer_boolean ??
            a?.attributes?.answer_choice ??
            a?.attributes?.answer ??
            a?.attributes?.value ?? // legacy
            null;
          if (raw !== null && raw !== undefined) {
            answers[qid] = normalizeAnswer(raw);
          }
        }
      } catch (e) {
        // Often permission or endpoint shape differences—log and fall back
        diag.push({ step: "answers-request-error", error: String(e) });
      }
    }

    // 3) Fallback: fetch answers from event bookings includes if still none
    if (Object.keys(answers).length === 0) {
      const bookingsUrl =
        `https://api.planningcenteronline.com/calendar/v2/events/${event_id}/resource_bookings?include=` +
        [
          "resource",
          "resource_question_answers.resource_question",
          "resource_question_answers.choice",
        ].join(",");
      try {
        const bJson = await pcoGet(bookingsUrl);
        const included = bJson.included || [];
        const answerItems = included.filter((x) => x.type === "ResourceQuestionAnswer");
        diag.push({ step: "answers-bookings-fallback", included: included.length, answersFound: answerItems.length });

        for (const a of answerItems) {
          const qid = a?.relationships?.resource_question?.data?.id;
          if (!qid) continue;
          const raw =
            a?.attributes?.answer_text ??
            a?.attributes?.answer_number ??
            a?.attributes?.answer_boolean ??
            a?.attributes?.answer_choice ??
            a?.attributes?.answer ??
            a?.attributes?.value ?? // legacy
            null;
          if (raw !== null && raw !== undefined) {
            answers[qid] = normalizeAnswer(raw);
          }
        }
      } catch (e) {
        diag.push({ step: "answers-bookings-error", error: String(e) });
      }
    }

    // 4) Event summary (optional)
    let event = null;
    try {
      const eUrl = `https://api.planningcenteronline.com/calendar/v2/events/${event_id}`;
      const eJson = await pcoGet(eUrl);
      event = {
        id: eJson.data?.id,
        name: eJson.data?.attributes?.name,
        starts_at: eJson.data?.attributes?.starts_at,
        ends_at: eJson.data?.attributes?.ends_at,
        summary: eJson.data?.attributes?.summary,
        description: eJson.data?.attributes?.description,
        percent_approved: eJson.data?.attributes?.percent_approved,
      };
      diag.push({ step: "event", ok: true });
    } catch (e) {
      diag.push({ step: "event-error", error: String(e) });
    }

    return Response.json({
      ok: true,
      event,
      questions,
      answers,
      totals: { questions: questions.length, answers: Object.keys(answers).length },
      diag,
    });
  } catch (err) {
    diag.push({ step: "fatal", error: String(err) });
    return Response.json({ ok: false, error: String(err), diag }, { status: 500 });
  }
});