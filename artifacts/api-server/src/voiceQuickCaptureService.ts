import { openai } from "./openai";
import { logger } from "./lib/logger";

export interface VoiceCaptureClient {
  id: string;
  firstName: string;
  lastName: string | null;
}

export interface VoiceCaptureDraft {
  title: string;
  clientId: string | null;
  clientNameGuess: string | null;
  scheduledDate: string | null; // YYYY-MM-DD
  scheduledTime: string | null; // HH:mm (24h)
  notes: string | null;
  confidence: "high" | "medium" | "low";
}

const SYSTEM_PROMPT = `You turn a home-service provider's spoken quick-capture request into a structured draft job.

You will be given:
- The provider's raw speech transcript.
- Today's date (for resolving relative dates like "tomorrow" or "next Tuesday").
- A list of the provider's existing clients (id, name).

Extract a single job/appointment draft. Match the client mentioned in the transcript against the provided client list by name (case-insensitive, allow minor misspellings). If there's a confident match, set clientId to that client's id and clientNameGuess to null. If a client name was clearly mentioned but does NOT match any existing client, leave clientId null and set clientNameGuess to the spoken name so the provider can create a new client. If no client was mentioned at all, leave both null.

Resolve relative dates/times (e.g. "tomorrow morning", "next Friday at 2pm") into an absolute scheduledDate (YYYY-MM-DD) and scheduledTime (24-hour HH:mm), using today's date as the reference point. If no date/time was mentioned, leave both null.

Respond with ONLY a JSON object matching this exact shape, no markdown, no commentary:
{
  "title": string,               // short job title, e.g. "Fix leaking kitchen faucet"
  "clientId": string | null,
  "clientNameGuess": string | null,
  "scheduledDate": string | null,
  "scheduledTime": string | null,
  "notes": string | null,        // any extra detail from the transcript not captured above
  "confidence": "high" | "medium" | "low"
}`;

export async function parseVoiceJobRequest(params: {
  transcript: string;
  clients: VoiceCaptureClient[];
  now?: Date;
}): Promise<VoiceCaptureDraft> {
  const { transcript, clients } = params;
  const now = params.now ?? new Date();

  const fallback: VoiceCaptureDraft = {
    title: transcript.trim().slice(0, 80) || "New job",
    clientId: null,
    clientNameGuess: null,
    scheduledDate: null,
    scheduledTime: null,
    notes: null,
    confidence: "low",
  };

  if (!openai.apiKey) {
    return fallback;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            transcript,
            today: now.toISOString().slice(0, 10),
            clients: clients.map((c) => ({
              id: c.id,
              name: `${c.firstName} ${c.lastName ?? ""}`.trim(),
            })),
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return fallback;

    const parsed = JSON.parse(raw);
    const clientIds = new Set(clients.map((c) => c.id));

    return {
      title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : fallback.title,
      clientId:
        typeof parsed.clientId === "string" && clientIds.has(parsed.clientId)
          ? parsed.clientId
          : null,
      clientNameGuess:
        typeof parsed.clientNameGuess === "string" && parsed.clientNameGuess.trim()
          ? parsed.clientNameGuess.trim()
          : null,
      scheduledDate:
        typeof parsed.scheduledDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.scheduledDate)
          ? parsed.scheduledDate
          : null,
      scheduledTime:
        typeof parsed.scheduledTime === "string" && /^\d{1,2}:\d{2}$/.test(parsed.scheduledTime)
          ? parsed.scheduledTime
          : null,
      notes: typeof parsed.notes === "string" && parsed.notes.trim() ? parsed.notes.trim() : null,
      confidence: ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "medium",
    };
  } catch (err) {
    logger.warn({ err }, "[voiceQuickCaptureService] parseVoiceJobRequest failed, using fallback");
    return fallback;
  }
}
