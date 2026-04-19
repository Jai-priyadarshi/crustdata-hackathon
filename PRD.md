PRD: ProspectAI — Autonomous SDR Agent
Powered by Crustdata × Claude API

1. Product Vision
ProspectAI is a natural-language-driven autonomous SDR agent that replaces Apollo + LinkedIn Sales Navigator. Users describe their ideal prospect in plain English — the agent finds, enriches, detects intent signals, generates personalised outreach, and manages follow-up sequences automatically.
Demo ICP for hackathon: Geotechnical engineering firms (Geolayer use case)
Generic: Any B2B company, any title, any geography

2. Core User Flow
User types natural language query
        ↓
LLM translates to structured API filters
        ↓
Crustdata finds + enriches prospects
        ↓
Intent signal detection from public posts
        ↓
Personalised email generated per prospect
        ↓
Follow-up sequence scheduled
        ↓
Export / send

3. Features — MVP Scope
Feature 1 — Natural Language Query Interface
User types:

"Find 20 Directors and Principal Geotechnical Engineers at mid-size site investigation firms in Australia and UK"

Claude translates this to structured Crustdata filters:
json{
  "titles": ["Director", "Principal Geotechnical Engineer", "Managing Director"],
  "industries": ["Civil Engineering", "Geotechnical Engineering"],
  "company_size": "10-200",
  "locations": ["Australia", "United Kingdom"]
}
```

---

### Feature 2 — Prospect Discovery Pipeline

**Step 1 — Company identification:**
```
POST /company/search
→ filters: industry, headcount, location, funding stage
→ returns: list of target companies
```

**Step 2 — Contact discovery:**
```
POST /person/search
→ filters: title, seniority, company, location
→ returns: list of matching people
```

**Step 3 — Contact enrichment:**
```
POST /person/enrich
→ input: person ID from step 2
→ returns: verified email, employment history, skills, LinkedIn
```

---

### Feature 3 — Intent Signal Detection

For each enriched prospect:
```
POST /web/search/live
→ query: "[Name] borehole log digitisation manual data entry"
→ query: "[Company] AGS format gINT data management"
→ returns: recent public posts, mentions, articles
```

**Intent scoring:**
- Mentioned pain point keyword → High intent 🔴
- Works at firm with relevant tech stack → Medium intent 🟡
- No signals found → Low intent ⚪

---

### Feature 4 — Personalised Email Generation

Claude generates a personalised email per prospect using:
- Their name, title, company
- Their employment history
- Intent signals found
- Your product context (configurable per user)

**Example output for Geolayer:**
> *"Hi David, noticed WSP's geotechnical team is still manually entering borehole log data — I built a tool that automates this entirely. 20 seconds per log instead of 20 minutes. Happy to run a free pilot on your actual logs."*

**Tone options:** Formal / Casual / Technical

---

### Feature 5 — Follow-Up Sequence

Auto-generate a 3-email sequence per prospect:

| Email | Timing | Angle |
|---|---|---|
| **Email 1** | Day 0 | Pain point + product intro |
| **Email 2** | Day 5 | New angle — social proof / demo |
| **Email 3** | Day 12 | Final follow-up — low friction ask |

Each email personalised to the prospect's context.

---

### Feature 6 — Campaign Dashboard

| Column | Data |
|---|---|
| Name | Prospect name |
| Company | Company name |
| Title | Job title |
| Email | Verified email |
| Intent | 🔴🟡⚪ |
| Status | Draft / Sent / Replied |
| Sequence | Email 1/2/3 |
| Actions | View / Edit / Send |

---

## 4. Technical Architecture
```
Frontend (React + Vite + Tailwind)
        ↓
Backend (FastAPI or Django)
        ↓
┌─────────────────────────────────┐
│         Orchestration Layer      │
│         (Claude API)             │
│  - Query translation             │
│  - Intent analysis               │
│  - Email generation              │
│  - Follow-up writing             │
└─────────────────────────────────┘
        ↓
┌─────────────────────────────────┐
│         Crustdata APIs           │
│  /company/search                 │
│  /company/identify               │
│  /person/search                  │
│  /person/enrich                  │
│  /web/search/live                │
└─────────────────────────────────┘
        ↓
Database (PostgreSQL / Supabase)
- Campaigns
- Prospects
- Emails
- Sequences
```

---

## 5. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + Tailwind |
| Backend | FastAPI (Python) |
| AI Orchestration | Claude API (claude-sonnet-4-20250514) |
| Prospect Data | Crustdata APIs |
| Database | Supabase (PostgreSQL) |
| Email sending | Resend or SendGrid API |
| Hosting | Render or Railway |

---

## 6. Claude API Usage — Specific Prompts

### Prompt 1 — Query Translation
```
System: You are an expert B2B sales researcher. Convert natural language 
prospect queries into structured Crustdata API filters. Return only JSON.

User: "Find 20 Directors at mid-size geotechnical firms in Australia"

Output: {
  "titles": ["Director", "Managing Director", "Principal Engineer"],
  "industries": ["Geotechnical Engineering", "Civil Engineering"],
  "locations": ["Australia"],
  "company_headcount_min": 10,
  "company_headcount_max": 500,
  "limit": 20
}
```

### Prompt 2 — Intent Analysis
```
System: You are analysing web search results to detect buying intent 
for [PRODUCT]. Score as HIGH/MEDIUM/LOW and extract the key signal.

Input: [web search results for prospect]
Output: {
  "intent_score": "HIGH",
  "signal": "Posted about manual data entry being painful last week",
  "quote": "Spending hours entering borehole data manually..."
}
```

### Prompt 3 — Email Generation
```
System: You are an expert SDR writing highly personalised cold emails.
Write a short, specific cold email (under 100 words) that:
- Opens with their specific pain point or recent activity
- Mentions the product benefit in one line
- Ends with one low-friction ask
Never use generic openers. Never say "I hope this finds you well."

Prospect context: [enriched profile + intent signals]
Product context: [user's product description]
Tone: [formal/casual/technical]
```

### Prompt 4 — Follow-Up Sequence
```
System: Write a 3-email follow-up sequence for this prospect.
Each email must take a different angle.
Email 1: Pain point
Email 2: Social proof / new insight
Email 3: Final low-friction ask

Keep each under 80 words. Different opening line each time.
```

---

## 7. Demo Script — Hackathon Presentation

**Setup (30 seconds):**
> *"GTM teams burn weeks on manual prospecting. We built an autonomous SDR agent that finds prospects, detects intent, and writes personalised outreach — entirely from a natural language query."*

**Demo flow (3 minutes):**

1. Type query: *"Find 20 Directors at geotechnical site investigation firms in Australia who are talking about data management"*
2. Show agent translating query → API filters (live)
3. Show prospects appearing with enriched profiles
4. Show intent signals detected — highlight one HIGH intent prospect
5. Show personalised email generated for that prospect
6. Show 3-email follow-up sequence
7. Show campaign dashboard with all 20 prospects ready to send

**Closing line:**
> *"This is what we're using to find customers for our own startup Geolayer — we've already identified 200+ qualified prospects in 10 minutes that would have taken us weeks manually."*

---

## 8. Build Timeline — Hackathon Sprint

| Hour | Task |
|---|---|
| 0–2 | Setup: React frontend, FastAPI backend, Crustdata auth, Claude API auth |
| 2–4 | Feature 1: Natural language query → API filters (Claude translation) |
| 4–6 | Feature 2: Prospect discovery pipeline (company → person → enrich) |
| 6–8 | Feature 3: Intent signal detection via web search |
| 8–10 | Feature 4: Email generation per prospect |
| 10–12 | Feature 5: Follow-up sequence generation |
| 12–14 | Feature 6: Campaign dashboard UI |
| 14–16 | Polish, bug fixes, demo prep |

---

## 9. What Makes This Win the Hackathon

- **Real use case** — you're using this for Geolayer right now. Judges love that.
- **Full vertical demo** — geotechnical ICP is specific and memorable
- **Every Crustdata API used** — shows depth of integration
- **Claude does the hard work** — query translation, intent analysis, email writing, sequence generation
- **Genuinely useful** — not a toy, a real sales tool

---

## 10. Geolayer-Specific Configuration

For your own use after the hackathon, configure the agent with:
```
Product: Geolayer
Description: AI tool that extracts borehole log data from PDFs 
into Excel/AGS automatically. Handles scanned and handwritten logs.
Pain point keywords: borehole log, manual data entry, digitisation, 
AGS format, gINT, OpenGround, SPT, site investigation
Target titles: Director, Managing Director, Principal Geotechnical 
Engineer, Geotechnical Manager, Associate Director
Target industries: Geotechnical Engineering, Civil Engineering, 
Site Investigation, Ground Engineering
Target locations: Australia, United Kingdom, India
Company size: 10–500 employees

