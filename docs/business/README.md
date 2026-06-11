# Business Knowledge Base

This folder is the shared knowledge base for the Yield "AI team" (defined in `.claude/agents/`).
Each agent reads and updates files here so research and decisions persist across sessions instead
of being re-derived or re-explained every time.

## Files

- `business-model.md` — pricing, plans, business model notes (owned by `ceo`, informed by `docs/PLAN.md`)
- `competitors.md` — competitive landscape (owned by `ceo`/`product`)
- `product-backlog.md` — prioritized feature backlog (owned by `product`)
- `brand-voice.md` — tone, vocabulary, visual direction (owned by `creative`)
- `marketing-log.md` — campaign ideas and results (owned by `marketing`)
- `data-strategy.md` — what data to collect and why (owned by `data`)
- `tech-radar.md` — emerging tech worth watching (owned by `development`)
- `security-notes.md` — security review checklist and known gaps (owned by `security`)
- `legal-notes.md` — compliance questions and research (owned by `lawyer`)
- `decisions-log.md` — running log of notable decisions/recommendations and who made them

## How agents should use this

- Read relevant files before starting research, to avoid duplicating work.
- Update your file(s) as you learn things — append, don't rewrite history.
- Anything that's a real commitment (money, legal, public communication, production deploys) gets
  flagged to the founder, not decided here.

## The team

| Agent | Role |
|-------|------|
| `ceo` | Business strategy, competitive analysis, brainstorming |
| `engineer` | Implementation, bug fixes, deployment |
| `qa` | Reviews engineer's work, finds bugs/edge cases |
| `security` | Security review of code, auth, data handling |
| `lawyer` | Compliance/legal research (CCPA, ADA, etc.) |
| `marketing` | Go-to-market, social media, content |
| `creative` | UI/UX, visual design, brand voice |
| `product` | Feature prioritization, competitor feature research |
| `data` | What to measure, data strategy, insights |
| `development` | Tech scouting, new integrations/platforms |

Invoke any of them by asking — e.g. "ask the ceo agent about X" or just describe the task and the
right specialist will be picked.
