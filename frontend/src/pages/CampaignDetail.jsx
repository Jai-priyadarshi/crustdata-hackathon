import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCampaign, getProspects, updateProspect, updateEmail, sendEmail, regenerateEmails } from '../api'

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

export default function CampaignDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [campaign, setCampaign] = useState(null)
  const [prospects, setProspects] = useState([])
  const [selected, setSelected] = useState(null)
  const [activeEmail, setActiveEmail] = useState(0)
  const [editingEmail, setEditingEmail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

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
      const updated = await getProspects(id)
      setProspects(updated.data)
      setSelected(updated.data.find(p => p.id === selected?.id))
    } catch (e) {
      alert(e.response?.data?.error || 'Send failed')
    } finally {
      setSending(false)
    }
  }

  async function handleSaveEmail(email) {
    await updateEmail(email.id, { subject: editingEmail.subject, body: editingEmail.body })
    const updated = await getProspects(id)
    setProspects(updated.data)
    setSelected(updated.data.find(p => p.id === selected?.id))
    setEditingEmail(null)
  }

  async function handleRegenerate() {
    setRegenerating(true)
    try {
      await regenerateEmails(selected.id)
      const updated = await getProspects(id)
      setProspects(updated.data)
      setSelected(updated.data.find(p => p.id === selected?.id))
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
              onClick={() => { setSelected(p); setActiveEmail(0); setEditingEmail(null) }}
              className={`px-4 py-4 border-b border-gray-800 cursor-pointer hover:bg-[#1a1d27] transition-colors ${selected?.id === p.id ? 'bg-[#1a1d27] border-l-2 border-l-violet-500' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-white font-medium text-sm truncate">{p.name}</p>
                  <p className="text-gray-400 text-xs truncate">{p.title}</p>
                  <p className="text-gray-500 text-xs truncate">{p.company}</p>
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
                <div>
                  <h2 className="text-xl font-bold text-white">{selected.name}</h2>
                  <p className="text-gray-400">{selected.title} · {selected.company}</p>
                  {selected.email && <p className="text-violet-400 text-sm mt-1">{selected.email}</p>}
                  {selected.location && <p className="text-gray-500 text-sm">{selected.location}</p>}
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
                        onClick={() => { setActiveEmail(i); setEditingEmail(null) }}
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
                    {editingEmail ? (
                      <div className="space-y-3">
                        <input
                          className="w-full bg-[#0f1117] border border-gray-700 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                          value={editingEmail.subject}
                          onChange={e => setEditingEmail({ ...editingEmail, subject: e.target.value })}
                          placeholder="Subject"
                        />
                        <textarea
                          className="w-full bg-[#0f1117] border border-gray-700 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-violet-500 resize-none"
                          rows={8}
                          value={editingEmail.body}
                          onChange={e => setEditingEmail({ ...editingEmail, body: e.target.value })}
                        />
                        <div className="flex gap-2">
                          <button onClick={() => handleSaveEmail(currentEmail)} className="bg-violet-600 hover:bg-violet-500 text-white text-sm px-4 py-2 rounded-lg transition-colors">Save</button>
                          <button onClick={() => setEditingEmail(null)} className="text-gray-400 hover:text-white text-sm px-4 py-2 rounded-lg border border-gray-700 transition-colors">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between mb-3">
                          <p className="text-gray-300 font-medium text-sm">Subject: {currentEmail.subject}</p>
                          <button onClick={() => setEditingEmail({ subject: currentEmail.subject, body: currentEmail.body })}
                            className="text-gray-600 hover:text-gray-300 text-xs transition-colors">Edit</button>
                        </div>
                        <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{currentEmail.body}</p>
                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => handleSendEmail(currentEmail.id)}
                            disabled={sending || !!currentEmail.sent_at || !selected.email}
                            className="bg-violet-600 hover:bg-violet-500 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed text-white text-sm px-4 py-2 rounded-lg transition-colors"
                          >
                            {currentEmail.sent_at ? 'Sent ✓' : sending ? 'Sending...' : 'Send'}
                          </button>
                          {!selected.email && <p className="text-yellow-600 text-xs self-center">No email address found</p>}
                        </div>
                      </>
                    )}
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
