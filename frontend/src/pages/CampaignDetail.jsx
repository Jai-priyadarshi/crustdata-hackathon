import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCampaign, getProspects, updateEmail, sendEmail, regenerateEmails } from '../api'

const INTENT_BADGE = {
  high: 'bg-red-900/40 text-red-400 border border-red-800',
  medium: 'bg-yellow-900/40 text-yellow-400 border border-yellow-800',
  low: 'bg-gray-800 text-gray-400 border border-gray-700',
}
const INTENT_DOT = { high: '🔴', medium: '🟡', low: '⚪' }
const STATUS_BADGE = {
  draft: 'bg-gray-800 text-gray-300',
  sent: 'bg-blue-900/40 text-blue-400',
  replied: 'bg-green-900/40 text-green-400',
}

function EmailEditor({ email, onSaved }) {
  const [subject, setSubject] = useState(email.subject)
  const [body, setBody] = useState(email.body)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Sync when email prop changes (e.g. switching tabs or regenerate)
  useEffect(() => {
    setSubject(email.subject)
    setBody(email.body)
    setDirty(false)
  }, [email.id, email.subject, email.body])

  async function handleSave() {
    setSaving(true)
    try {
      await updateEmail(email.id, { subject, body })
      setDirty(false)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Subject</label>
        <input
          className="w-full bg-[#0f1117] border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500"
          value={subject}
          onChange={e => { setSubject(e.target.value); setDirty(true) }}
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Body</label>
        <textarea
          className="w-full bg-[#0f1117] border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-violet-500 resize-none leading-relaxed"
          rows={10}
          value={body}
          onChange={e => { setBody(e.target.value); setDirty(true) }}
        />
      </div>
      {dirty && (
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          <button
            onClick={() => { setSubject(email.subject); setBody(email.body); setDirty(false) }}
            className="text-gray-400 hover:text-white text-sm px-4 py-2 rounded-lg border border-gray-700 transition-colors"
          >
            Discard
          </button>
        </div>
      )}
    </div>
  )
}

export default function CampaignDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState(null)
  const [prospects, setProspects] = useState([])
  const [selected, setSelected] = useState(null)
  const [activeEmail, setActiveEmail] = useState(0)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const reload = useCallback(async (keepSelectedId) => {
    const [, p] = await Promise.all([getCampaign(id), getProspects(id)])
    setProspects(p.data)
    if (keepSelectedId) setSelected(p.data.find(x => x.id === keepSelectedId) || p.data[0])
  }, [id])

  useEffect(() => {
    Promise.all([getCampaign(id), getProspects(id)]).then(([c, p]) => {
      setCampaign(c.data)
      setProspects(p.data)
      if (p.data.length > 0) setSelected(p.data[0])
    }).finally(() => setLoading(false))
  }, [id])

  async function handleSendEmail(emailId) {
    setSending(true)
    try {
      await sendEmail(emailId)
      await reload(selected?.id)
    } catch (e) {
      alert(e.response?.data?.error || 'Send failed')
    } finally {
      setSending(false)
    }
  }

  async function handleRegenerate() {
    setRegenerating(true)
    try {
      await regenerateEmails(selected.id)
      await reload(selected?.id)
      setActiveEmail(0)
    } finally {
      setRegenerating(false)
    }
  }

  if (loading) return <div className="text-gray-500 text-center py-20">Loading...</div>

  const emails = selected?.emails || []
  const currentEmail = emails[activeEmail]

  return (
    <div className="min-h-screen bg-[#0f1117] flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate('/campaigns')} className="text-gray-500 hover:text-gray-300 transition-colors text-sm">← Campaigns</button>
        <div>
          <h1 className="text-white font-semibold">{campaign?.name}</h1>
          <p className="text-gray-500 text-xs">{campaign?.query}</p>
        </div>
        <span className="ml-auto text-violet-400 font-semibold">{prospects.length} prospects</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Prospect list */}
        <div className="w-80 border-r border-gray-800 overflow-y-auto">
          {prospects.map(p => (
            <div
              key={p.id}
              onClick={() => { setSelected(p); setActiveEmail(0) }}
              className={`px-4 py-4 border-b border-gray-800 cursor-pointer hover:bg-[#1a1d27] transition-colors ${selected?.id === p.id ? 'bg-[#1a1d27] border-l-2 border-l-violet-500' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  {p.profile_picture
                    ? <img src={p.profile_picture} alt={p.name} className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5" />
                    : <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center shrink-0 mt-0.5 text-gray-400 text-xs font-medium">{p.name[0]}</div>
                  }
                  <div className="min-w-0">
                    <p className="text-white font-medium text-sm truncate">{p.name}</p>
                    <p className="text-gray-400 text-xs truncate">{p.title}</p>
                    <p className="text-gray-500 text-xs truncate">{p.company}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${INTENT_BADGE[p.intent]}`}>{INTENT_DOT[p.intent]} {p.intent}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[p.status]}`}>{p.status}</span>
                </div>
              </div>
              {p.intent_signal && (
                <p className="text-gray-600 text-xs mt-1 truncate">{p.intent_signal}</p>
              )}
            </div>
          ))}
        </div>

        {/* Prospect detail */}
        {selected && (
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="max-w-2xl">
              {/* Prospect header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-start gap-4">
                  {selected.profile_picture
                    ? <img src={selected.profile_picture} alt={selected.name} className="w-14 h-14 rounded-full object-cover shrink-0" />
                    : <div className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center shrink-0 text-gray-300 text-xl font-semibold">{selected.name[0]}</div>
                  }
                  <div>
                  <h2 className="text-xl font-bold text-white">{selected.name}</h2>
                  <p className="text-gray-400">{selected.title} · {selected.company}</p>
                  {selected.email && <p className="text-violet-400 text-sm mt-1">{selected.email}</p>}
                  {selected.location && <p className="text-gray-500 text-sm">{selected.location}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  {selected.linkedin_url && (
                    <a href={selected.linkedin_url} target="_blank" rel="noreferrer"
                      className="text-xs text-gray-400 hover:text-white border border-gray-700 rounded-lg px-3 py-1.5 transition-colors">
                      LinkedIn
                    </a>
                  )}
                </div>
              </div>

              {/* Intent signal */}
              {selected.intent_signal && (
                <div className={`rounded-xl px-4 py-3 mb-6 ${INTENT_BADGE[selected.intent]}`}>
                  <p className="text-sm font-medium">{INTENT_DOT[selected.intent]} Intent: {selected.intent}</p>
                  <p className="text-sm mt-1 opacity-80">{selected.intent_signal}</p>
                  {selected.intent_quote && <p className="text-xs mt-1 opacity-60 italic">"{selected.intent_quote}"</p>}
                </div>
              )}

              {/* Email sequence tabs */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex gap-2">
                    {emails.map((e, i) => (
                      <button
                        key={e.id}
                        onClick={() => setActiveEmail(i)}
                        className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${activeEmail === i ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white border border-gray-700'}`}
                      >
                        Email {e.sequence_number} {e.scheduled_day > 0 ? `(Day ${e.scheduled_day})` : '(Day 0)'}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleRegenerate}
                    disabled={regenerating}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {regenerating ? 'Regenerating...' : '↺ Regenerate'}
                  </button>
                </div>

                {currentEmail && (
                  <div className="bg-[#1a1d27] border border-gray-800 rounded-2xl p-5">
                    <EmailEditor
                      key={currentEmail.id}
                      email={currentEmail}
                      onSaved={() => reload(selected?.id)}
                    />
                    <div className="mt-4 pt-4 border-t border-gray-800 flex gap-2 items-center">
                      <button
                        onClick={() => handleSendEmail(currentEmail.id)}
                        disabled={sending || !!currentEmail.sent_at || !selected.email}
                        className="bg-violet-600 hover:bg-violet-500 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed text-white text-sm px-4 py-2 rounded-lg transition-colors"
                      >
                        {currentEmail.sent_at ? 'Sent ✓' : sending ? 'Sending...' : 'Send'}
                      </button>
                      {!selected.email && <p className="text-gray-500 text-xs">No contact email — copy & send manually</p>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
