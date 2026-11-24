import env from '../config/env.js';

const VALID_EMOTIONS = new Set(['neutral', 'laugh', 'shock', 'roast', 'applause', 'think']);
const VALID_SFX = new Set(['', 'applause', 'laugh', 'drumroll', 'rimshot', 'sip_tea', 'buzzer']);
const DEPRECATED_MODELS = new Set(['gemini-2.5-flash', 'models/gemini-2.5-flash']);
const MODEL_FALLBACK_CHAIN = [
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.8-flash',
];

function isGeminiConfigured() {
  return (
    Boolean(env.geminiApiKey) &&
    !env.geminiApiKey.toLowerCase().includes('your_gemini_api_key')
  );
}

function redactKey(text) {
  return String(text || '').replace(/([?&]key=)[^&\s"']+/gi, '$1[REDACTED]');
}

function getCandidateModels() {
  const configured = (env.geminiModel || '').trim().replace(/^models\//, '');
  const list = [configured, ...MODEL_FALLBACK_CHAIN]
    .filter(Boolean)
    .filter((m) => !DEPRECATED_MODELS.has(m));
  return [...new Set(list)];
}

async function callGeminiJson({
  systemInstruction = '',
  userPrompt,
  temperature = 0.85,
  maxOutputTokens = 1024,
}) {
  const models = getCandidateModels();

  for (const model of models) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(env.geminiApiKey)}`;

    const payload = {
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature,
        maxOutputTokens,
      },
    };
    if (systemInstruction) {
      payload.system_instruction = { parts: [{ text: systemInstruction }] };
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.warn(
          `Gemini model ${model} HTTP ${res.status}: ${redactKey(errText).slice(0, 160)}`
        );
        continue;
      }

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleaned = rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(match ? match[0] : cleaned);

      return { parsed, modelUsed: model };
    } catch (err) {
      console.warn(`Gemini model ${model} failed:`, redactKey(err?.message || err));
    }
  }

  return null;
}

function buildFallbackReply(persona, userMessage, isRapidFire, aiRole = 'host') {
  const snippet = (userMessage || '').trim().slice(0, 70);

  if (aiRole === 'guest') {
    return {
      reply: `What a fantastic question from the host chair! Talking about "${snippet}" — honestly, passion and a little dramatic flair are how legends are made. What is your next curveball for me?`,
      emotion: 'laugh',
      sfxCue: 'applause',
      lowerThirdText: `${(persona?.name || 'AI GUEST').toUpperCase()} — EXCLUSIVE INTERVIEW`,
      rapidFirePoints: isRapidFire ? 15 : 0,
      source: 'offline-persona-fallback',
    };
  }

  const style = persona?.id || 'chai-with-ai';
  const byStyle = {
    'chai-with-ai': {
      reply: `Oh, "${snippet}" — bold confession on national chai television! Keep talking like that and the Chai Hamper is practically yours, darling.`,
      emotion: 'laugh',
      sfxCue: 'sip_tea',
      lowerThirdText: 'BREAKING CONFESSION ON THE CHAI COUCH',
    },
    'hot-seat': {
      reply: `A remarkable answer: "${snippet}". The studio lights burn brighter when truth meets conviction — lock that thought in!`,
      emotion: 'applause',
      sfxCue: 'drumroll',
      lowerThirdText: 'MIDNIGHT HOT SEAT — LOCKED IN',
    },
    'desi-roast': {
      reply: `Bro really walked onto live stream and dropped "${snippet}"! Chat is going wild right now — respect the fearless chaos.`,
      emotion: 'roast',
      sfxCue: 'rimshot',
      lowerThirdText: 'CHAT REACTION: ABSOLUTE SCENES',
    },
    'anime-couch': {
      reply: `Whoa — "${snippet}"?! That energy just shattered my sunglasses! Pure main-character aura right there.`,
      emotion: 'shock',
      sfxCue: 'applause',
      lowerThirdText: 'MAIN CHARACTER ENERGY DETECTED',
    },
    'mock-interview': {
      reply: `Solid take on "${snippet}". Now tell me how you handle edge cases, latency spikes, and scale when real users hit production.`,
      emotion: 'think',
      sfxCue: 'drumroll',
      lowerThirdText: 'SHARK PANEL TECHNICAL FOLLOW-UP',
    },
    'classic-meet': {
      reply: `Great point on "${snippet}"! Audience in the studio room, drop your reactions or raise a hand to jump in.`,
      emotion: 'applause',
      sfxCue: 'applause',
      lowerThirdText: 'MEETLITE STUDIO — LIVE DISCUSSION',
    },
  };

  const picked = byStyle[style] || byStyle['chai-with-ai'];
  return {
    ...picked,
    rapidFirePoints: isRapidFire ? 10 : 0,
    source: 'offline-persona-fallback',
  };
}

function sanitizeAiPayload(parsed, persona, isRapidFire, modelUsed, aiRole = 'host') {
  const emotion = VALID_EMOTIONS.has(parsed?.emotion) ? parsed.emotion : 'neutral';
  const sfxCue = VALID_SFX.has(parsed?.sfxCue) ? parsed.sfxCue : '';
  const reply =
    typeof parsed?.reply === 'string' && parsed.reply.trim()
      ? parsed.reply.trim()
      : buildFallbackReply(persona, '', isRapidFire, aiRole).reply;
  const lowerThirdText =
    typeof parsed?.lowerThirdText === 'string' && parsed.lowerThirdText.trim()
      ? parsed.lowerThirdText.trim().slice(0, 80)
      : `${persona?.showTitle || 'TFounZ Live'} • ON AIR`.toUpperCase();
  const rapidFirePoints = isRapidFire
    ? Math.max(5, Math.min(25, Number(parsed?.rapidFirePoints) || 10))
    : 0;

  return {
    reply,
    emotion,
    sfxCue,
    lowerThirdText,
    rapidFirePoints,
    source: 'gemini',
    modelUsed,
  };
}

export async function generateHostReply({
  persona,
  aiRole = 'host',
  history = [],
  userMessage,
  guestName = 'Guest',
  isRapidFire = false,
}) {
  if (!isGeminiConfigured()) {
    return buildFallbackReply(persona, userMessage, isRapidFire, aiRole);
  }

  const formattedHistory = history
    .slice(-10)
    .map((m) => `${m.senderType === 'ai' ? persona.name : m.senderName}: ${m.content}`)
    .join('\n');

  const roleFraming =
    aiRole === 'guest'
      ? `You are the CELEBRITY AI GUEST (${persona.name}) being interviewed by human show host "${guestName}" on "${persona.showTitle}". Answer the host's questions with charisma, memorable stories, and occasional witty banter back at the host.`
      : aiRole === 'co-host'
        ? `You are the AI CO-HOST (${persona.name}) moderating a multi-guest live studio show "${persona.showTitle}" alongside "${guestName}" and the live audience.`
        : `You are the AI TALK SHOW HOST (${persona.name}) of "${persona.showTitle}" interviewing guest "${guestName}".`;

  const systemInstruction = `
${persona.systemPrompt}

${roleFraming}
Keep your reply punchy, natural, and conversational (2 to 3 sentences max, under 65 words) so it sounds awesome when spoken aloud on air.
${isRapidFire ? 'This is the 60-second RAPID-FIRE ROUND! React fast with electric energy, award 5-25 points in rapidFirePoints (integer), and keep momentum high.' : ''}

Return STRICT raw JSON with these exact keys:
{
  "reply": "your spoken talk show response",
  "emotion": "one of: neutral, laugh, shock, roast, applause, think",
  "sfxCue": "one of: '', applause, laugh, drumroll, rimshot, sip_tea, buzzer",
  "lowerThirdText": "short 3-7 word TV chyron headline in ALL CAPS",
  "rapidFirePoints": 0
}
`.trim();

  const userPrompt = formattedHistory
    ? `Recent studio transcript:\n${formattedHistory}\n\n${guestName} just said: ${userMessage}`
    : `${guestName} just said on air: ${userMessage}`;

  const result = await callGeminiJson({
    systemInstruction,
    userPrompt,
    temperature: 0.85,
    maxOutputTokens: 1024,
  });

  if (!result) {
    return buildFallbackReply(persona, userMessage, isRapidFire, aiRole);
  }

  return sanitizeAiPayload(result.parsed, persona, isRapidFire, result.modelUsed, aiRole);
}

export async function generateRapidFireSet({ persona, aiRole = 'host', topic = '' }) {
  const fallback = persona?.rapidFireQuestions || [
    'What is one opinion you defend no matter what?',
    'Biggest win of this semester so far?',
    'Who deserves a shoutout on this show?',
    'Chai or midnight filter coffee?',
    'Describe your vibe today in 3 words!',
  ];

  if (!isGeminiConfigured()) {
    return { questions: fallback, source: 'offline-persona-fallback' };
  }

  const prompt =
    aiRole === 'guest'
      ? `Generate 5 punchy, fun, PG-13 Rapid-Fire interview questions that a human talk-show host can fire at AI celebrity guest "${persona.name}" on "${persona.showTitle}".${
          topic ? ` Theme: ${topic}.` : ''
        } Return ONLY JSON: { "questions": ["q1", "q2", "q3", "q4", "q5"] }`
      : `Generate 5 punchy, fun, PG-13 60-second Rapid-Fire talk show questions for "${
          persona.showTitle
        }" hosted by ${persona.name}.${topic ? ` Theme/topic: ${topic}.` : ''}
Return ONLY JSON: { "questions": ["q1", "q2", "q3", "q4", "q5"] }`;

  const result = await callGeminiJson({
    userPrompt: prompt,
    temperature: 0.9,
    maxOutputTokens: 1024,
  });

  if (result && Array.isArray(result.parsed?.questions) && result.parsed.questions.length >= 3) {
    return {
      questions: result.parsed.questions.slice(0, 5).map(String),
      source: 'gemini',
      modelUsed: result.modelUsed,
    };
  }

  return { questions: fallback, source: 'offline-persona-fallback' };
}

export async function generateEpisodeSummary({
  meetingTitle,
  persona,
  aiRole = 'host',
  transcript = [],
}) {
  const fallback = {
    headline: `${meetingTitle} — Studio Highlights`,
    highlights: [
      `Featured ${persona?.name || 'AI Persona'} as ${aiRole.toUpperCase()} on TFounZ Studio`,
      `Captured ${transcript.length} live show turns and studio reactions`,
      'Ready for auto-captioning in Filmy AI and voice mastering in SounZ AI',
    ],
    bestQuote:
      transcript.find((m) => m.senderType === 'ai')?.content ||
      'Unforgettable live talk-show energy on TFounZ Studio!',
    suggestedFilmyPrompt:
      'Remove background noise, transcribe speech and add synchronized bottom subtitles with boosted audio',
    source: 'offline-persona-fallback',
  };

  if (!isGeminiConfigured() || transcript.length === 0) {
    return fallback;
  }

  const lines = transcript
    .slice(-25)
    .map((m) => `${m.senderName}: ${m.content}`)
    .join('\n');

  const prompt = `You are a TV show executive producer summarizing an episode titled "${meetingTitle}" featuring ${
    persona?.name || 'AI Persona'
  } (${aiRole}).
Transcript:
${lines}

Return STRICT JSON:
{
  "headline": "catchy 5-10 word TV episode headline",
  "highlights": ["bullet 1", "bullet 2", "bullet 3"],
  "bestQuote": "most quotable 1-sentence moment from the transcript",
  "suggestedFilmyPrompt": "a natural-language video editing prompt for Filmy AI (mentioning subtitles, noise removal, or pacing)"
}`;

  const result = await callGeminiJson({
    userPrompt: prompt,
    temperature: 0.7,
    maxOutputTokens: 1024,
  });

  if (!result?.parsed) return fallback;

  return {
    headline: String(result.parsed.headline || fallback.headline),
    highlights:
      Array.isArray(result.parsed.highlights) && result.parsed.highlights.length
        ? result.parsed.highlights.slice(0, 4).map(String)
        : fallback.highlights,
    bestQuote: String(result.parsed.bestQuote || fallback.bestQuote),
    suggestedFilmyPrompt: String(
      result.parsed.suggestedFilmyPrompt || fallback.suggestedFilmyPrompt
    ),
    source: 'gemini',
    modelUsed: result.modelUsed,
  };
}
