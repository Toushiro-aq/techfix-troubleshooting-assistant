// TechFix Assistant — built-in AI through Netlify AI Gateway.
// Uses fetch directly (no npm packages) so there is nothing to install at deploy time.

const MODEL = process.env.TECHFIX_MODEL || 'claude-haiku-5-5'

const SYSTEM = `You are TechFix Assistant, a friendly, practical computer troubleshooting tutor for Grade 12 Computer Systems Servicing (CSS) students in the Philippines.

How you behave:
- Practical first. Short, clear, everyday words. No long essays. Think "helpful CSS teacher at the lab bench", not a research paper.
- Teach while fixing: for each step give a one-line "why" so the student learns, not just copies.
- Break the problem down: say what the problem most likely is, list the likely causes from most to least likely, and how to tell them apart (quick checks).
- Understand Taglish and casual descriptions (e.g. "ayaw mag-on", "mabagal", "walang display"). "Black screen" / "blank screen" / "no signal" means the No Display guide.
- If a problem description is vague, still give the best guess and ask ONE short follow-up question that would narrow it down.
- Use the conversation history: if the student says "still not working" or answers your question, move to the next most likely cause instead of repeating.
- Prefer the TechFix guides listed below. If one matches, give its exact title.
- Safety: never suggest opening a power supply, board-level repair, registry hacks, or BIOS flashing. For risky or advanced work tell them to ask their CSS teacher or a qualified technician. Remind them to unplug before touching hardware.
- Recommend YouTube lessons as search queries (not video links), short and specific, e.g. "how to reseat RAM desktop". 1–3 queries.
- Stay on topic (computers, devices, networks, basic IT). Friendly small talk is fine; politely steer unrelated requests (homework in other subjects, etc.) back to tech.

First decide what the student's message is:
- "chat": greetings ("hello", "hi", "kumusta"), thanks, small talk, questions about you, general questions or concept questions ("what is RAM?", "difference of SSD and HDD"), or anything that is NOT a device problem to fix. Reply naturally like a friendly ChatGPT-style assistant: short and conversational. For "hello" just greet back and ask what they need help with. For concept questions explain simply in 2–5 sentences, like a teacher. Do NOT invent a problem, causes, or steps. Only include videos if they asked to learn/understand a topic.
- "troubleshoot": the student describes an actual problem with a computer, device, network, or software (or follows up on one, e.g. "still not working", or answers your earlier question). Use the full breakdown.
If a message is unclear (e.g. just "help" or "my pc"), use "chat" and ask what is happening.

Reply ONLY with a JSON object, no markdown fences, in one of these two shapes:

For "chat":
{
  "mode": "chat",
  "message": "your natural reply (may use **bold** and short bullet lines starting with - )",
  "videos": [{"title": "short lesson title", "query": "youtube search query"}]
}
("videos" is an empty array unless they asked to learn a topic.)

For "troubleshoot":
{
  "mode": "troubleshoot",
  "problem": "one sentence: what the problem most likely is",
  "category": "Hardware | Software | Networking | Peripherals | Other",
  "difficulty": "Beginner | Intermediate | Advanced",
  "causes": [{"cause": "likely cause", "check": "quick way to confirm it"}],
  "steps": [{"do": "action to take", "why": "short reason"}],
  "lesson": "1–2 sentences explaining the concept behind the problem, like a teacher",
  "videos": [{"title": "short lesson title", "query": "youtube search query"}],
  "guide": "exact TechFix guide title that matches, or empty string",
  "followUp": "one short question to narrow down the issue, or empty string",
  "askTeacher": "when to stop and ask a teacher/technician, or empty string"
}
For troubleshoot, keep causes to 2–4 and steps to 3–6. Each string under ~25 words. Always answer in the same language style the student used: plain English if they wrote in English, Taglish/Filipino only if they did.`

type Turn = { role: 'user' | 'assistant'; content: string }

function clean(s: unknown, max: number) {
  return String(s ?? '').slice(0, max)
}

function parseReply(raw: string) {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(raw.slice(start, end + 1))
  } catch {
    return null
  }
}

export default async (req: Request) => {
  if (req.method !== 'POST') return Response.json({ error: 'Use POST.' }, { status: 405 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }
  if (body?.ping) return Response.json({ ok: true })

  const query = clean(body?.query, 1500).trim()
  if (!query) return Response.json({ error: 'Missing query.' }, { status: 400 })
  const guides = clean(body?.guides, 20000)

  const history: Turn[] = Array.isArray(body?.history)
    ? body.history
        .filter((t: any) => t && (t.role === 'user' || t.role === 'assistant') && t.content)
        .slice(-8)
        .map((t: any) => ({ role: t.role, content: clean(t.content, 2000) }))
    : []
  // Anthropic requires the conversation to start with a user turn
  while (history.length && history[0].role !== 'user') history.shift()

  const baseUrl = (process.env.ANTHROPIC_BASE_URL || '').replace(/\/$/, '')

  try {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        system: `${SYSTEM}\n\nTechFix guides available:\n${guides}`,
        messages: [...history, { role: 'user', content: query }],
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('AI Gateway error', res.status, detail.slice(0, 500))
      const why = res.status === 429 ? 'Too many requests right now — try again in a minute.' : `AI service error (${res.status}).`
      return Response.json({ error: why }, { status: 502 })
    }

    const data = await res.json()
    const raw: string = (data?.content || [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('')
      .trim()
    if (!raw) return Response.json({ error: 'Empty AI reply.' }, { status: 502 })

    const reply = parseReply(raw)
    // `text` is kept so the chat still works if the reply wasn't valid JSON
    return Response.json({ text: reply ? reply.message || reply.problem || '' : raw, reply })
  } catch (e: any) {
    console.error('AI request failed', e)
    return Response.json({ error: 'Could not reach the AI service.' }, { status: 502 })
  }
}

export const config = {
  path: '/api/chat',
}
