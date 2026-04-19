import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getCampaign, getProspects, updateEmail, updateProspect, sendEmail, regenerateEmails, deleteProspect, addProspect, scheduleCampaign, cancelSchedule, cancelCampaignSchedule } from '../api'

const INTENT_BADGE = {
  high: 'bg-red-900/40 text-red-400 border border-red-800',
  medium: 'bg-yellow-900/40 text-yellow-400 border border-yellow-800',
  low: 'bg-gray-800 text-gray-400 border border-gray-700',
}
const INTENT_DOT = { high: '🔴', medium: '🟡', low: '⚪' }
const STATUS_BADGE = {
  draft: 'bg-gray-800 text-gray-300',
  scheduled: 'bg-violet-900/40 text-violet-400',
  sent: 'bg-blue-900/40 text-blue-400',
  replied: 'bg-green-900/40 text-green-400',
}

function EmailEditor({ email, onSaved }) {
  const [subject, setSubject] = useState(email.subject)
  const [body, setBody] = useState(email.body)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

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
          <button onClick={handleSave} disabled={saving}
            className="bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm px-4 py-2 rounded-lg transition-colors">
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          <button onClick={() => { setSubject(email.subject); setBody(email.body); setDirty(false) }}
            className="text-gray-400 hover:text-white text-sm px-4 py-2 rounded-lg border border-gray-700 transition-colors">
            Discard
          </button>
        </div>
      )}
    </div>
  )
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function ScheduleModal({ onClose, onConfirm, loading }) {
  const [sendDays, setSendDays] = useState([0, 1, 2, 3])
  const [windowStart, setWindowStart] = useState(9)
  const [windowEnd, setWindowEnd] = useState(11)

  function toggleDay(d) {
    setSendDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort())
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-[#1a1d27] border border-gray-700 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold">Schedule Campaign</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none">×</button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="text-xs text-gray-400 mb-2 block">Send on</label>
            <div className="flex gap-1.5 flex-wrap">
              {DAYS.map((d, i) => (
                <button key={d} type="button" onClick={() => toggleDay(i)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${sendDays.includes(i) ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-2 block">Send window (local time)</label>
            <div className="flex items-center gap-3">
              <select value={windowStart} onChange={e => setWindowStart(+e.target.value)}
                className="bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500">
                {Array.from({length: 12}, (_, i) => i + 6).map(h => (
                  <option key={h} value={h}>{h}:00 AM</option>
                ))}
              </select>
              <span className="text-gray-500 text-sm">to</span>
              <select value={windowEnd} onChange={e => setWindowEnd(+e.target.value)}
                className="bg-[#0f1117] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500">
                {Array.from({length: 12}, (_, i) => i + 7).map(h => (
                  <option key={h} value={h}>{h <= 12 ? `${h}:00 ${h < 12 ? 'AM' : 'PM'}` : `${h-12}:00 PM`}</option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-gray-500 text-xs">Emails send at a random time within this window in each prospect's local timezone. Each prospect is staggered 2–7 min apart.</p>

          <button onClick={() => onConfirm({ send_days: sendDays, send_window_start: windowStart, send_window_end: windowEnd })}
            disabled={loading || sendDays.length === 0}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition-colors text-sm">
            {loading ? 'Scheduling...' : 'Schedule All Prospects'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddProspectModal({ campaignId, onClose, onAdded }) {
  const [form, setForm] = useState({ name: '', title: '', company: '', email: '', linkedin_url: '', location: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setLoading(true)
    setError('')
    try {
      await addProspect(campaignId, form)
      onAdded()
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add prospect')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-[#1a1d27] border border-gray-700 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold">Add Prospect</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input required
            className="w-full bg-[#0f1117] border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-violet-500"
            placeholder="Full name *"
            value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <input
              className="w-full bg-[#0f1117] border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-violet-500"
              placeholder="Job title"
              value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            <input
              className="w-full bg-[#0f1117] border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-violet-500"
              placeholder="Company"
              value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
          </div>
          <input type="email"
            className="w-full bg-[#0f1117] border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-violet-500"
            placeholder="Email address"
            value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <input
            className="w-full bg-[#0f1117] border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-violet-500"
            placeholder="LinkedIn URL"
            value={form.linkedin_url} onChange={e => setForm({ ...form, linkedin_url: e.target.value })} />
          <input
            className="w-full bg-[#0f1117] border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-violet-500"
            placeholder="Location"
            value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition-colors text-sm mt-1">
            {loading ? 'Adding & generating emails...' : 'Add Prospect'}
          </button>
        </form>
      </div>
    </div>
  )
}

function EmailField({ prospect, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(prospect.email || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setValue(prospect.email || ''); setEditing(false) }, [prospect.id, prospect.email])

  async function handleSave() {
    if (!value.trim()) return
    setSaving(true)
    try {
      await updateProspect(prospect.id, { email: value.trim() })
      onSaved()
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  if (prospect.email && !editing) {
    return (
      <p className="text-violet-400 text-sm mt-1 cursor-pointer hover:text-violet-300" onClick={() => setEditing(true)}>
        {prospect.email}
      </p>
    )
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 mt-1">
        <input
          autoFocus
          type="email"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
          className="bg-[#0f1117] border border-violet-500 rounded-lg px-3 py-1 text-white text-sm focus:outline-none w-56"
        />
        <button onClick={handleSave} disabled={saving}
          className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button onClick={() => setEditing(false)} className="text-xs text-gray-500 hover:text-gray-300">Cancel</button>
      </div>
    )
  }

  return (
    <button onClick={() => setEditing(true)} className="text-gray-500 hover:text-violet-400 text-sm mt-1 transition-colors">
      + Add email
    </button>
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
  const [scheduling, setScheduling] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)

  const reload = useCallback(async (keepSelectedId) => {
    const [, p] = await Promise.all([getCampaign(id), getProspects(id)])
    setProspects(p.data)
    if (keepSelectedId) setSelected(p.data.find(x => x.id === keepSelectedId) || p.data[0])
    else if (p.data.length > 0) setSelected(p.data[0])
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

  async function handleSchedule(settings) {
    setScheduling(true)
    try {
      await scheduleCampaign(id, settings)
      await reload(selected?.id)
    } finally {
      setScheduling(false)
      setShowScheduleModal(false)
    }
  }

  async function handleCancelSchedule(prospectId) {
    await cancelSchedule(prospectId)
    await reload(selected?.id)
  }

  async function handleCancelAll() {
    if (!confirm('Cancel all scheduled emails for this campaign?')) return
    await cancelCampaignSchedule(id)
    await reload(selected?.id)
  }

  const hasScheduled = prospects.some(p => p.emails?.some(e => e.status === 'scheduled'))

  async function handleDelete(prospectId) {
    if (!confirm('Delete this prospect?')) return
    await deleteProspect(prospectId)
    const remaining = prospects.filter(p => p.id !== prospectId)
    setProspects(remaining)
    if (selected?.id === prospectId) setSelected(remaining[0] || null)
  }

  if (loading) return <div className="text-gray-500 text-center py-20">Loading...</div>

  const emails = selected?.emails || []
  const currentEmail = emails[activeEmail]

  return (
    <div className="h-screen bg-[#0f1117] flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate('/campaigns')} className="text-gray-500 hover:text-gray-300 transition-colors text-sm">← Campaigns</button>
        <div>
          <h1 className="text-white font-semibold">{campaign?.name}</h1>
          <p className="text-gray-500 text-xs">{campaign?.query}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-violet-400 font-semibold">{prospects.length} prospects</span>
          {hasScheduled ? (
            <button onClick={handleCancelAll}
              className="bg-red-900/30 hover:bg-red-900/50 border border-red-800 text-red-400 hover:text-red-300 text-sm px-3 py-1.5 rounded-lg transition-colors">
              ✕ Cancel All Scheduled
            </button>
          ) : (
            <button onClick={() => setShowScheduleModal(true)}
              className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white text-sm px-3 py-1.5 rounded-lg transition-colors">
              ⏰ Schedule
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Prospect list */}
        <div className="w-80 border-r border-gray-800 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto min-h-0">
          {prospects.map(p => (
            <div
              key={p.id}
              onClick={() => { setSelected(p); setActiveEmail(0) }}
              className={`px-4 py-4 border-b border-gray-800 cursor-pointer hover:bg-[#1a1d27] transition-colors group ${selected?.id === p.id ? 'bg-[#1a1d27] border-l-2 border-l-violet-500' : ''}`}
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
                  <div className="flex items-center gap-1">
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(p.id) }}
                      className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all text-xs px-1"
                      title="Delete prospect"
                    >✕</button>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${INTENT_BADGE[p.intent]}`}>{INTENT_DOT[p.intent]} {p.intent}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[p.status] || 'bg-gray-800 text-gray-300'}`}>{p.status}</span>
                </div>
              </div>
              {p.intent_signal && (
                <p className="text-gray-600 text-xs mt-1 truncate">{p.intent_signal}</p>
              )}
            </div>
          ))}
          </div>
          <div className="p-3 border-t border-gray-800">
            <button
              onClick={() => setShowAddModal(true)}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
            >
              + Add Prospect
            </button>
          </div>
        </div>

        {/* Prospect detail */}
        {selected && (
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="max-w-2xl">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-start gap-4">
                  {selected.profile_picture
                    ? <img src={selected.profile_picture} alt={selected.name} className="w-24 h-24 rounded-full object-cover shrink-0" />
                    : <div className="w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center shrink-0 text-gray-300 text-3xl font-semibold">{selected.name[0]}</div>
                  }
                  <div>
                    <h2 className="text-xl font-bold text-white">{selected.name}</h2>
                    <p className="text-gray-400">{selected.title} · {selected.company}</p>
                    <EmailField prospect={selected} onSaved={() => reload(selected.id)} />
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

              {selected.intent_signal && (
                <div className={`rounded-xl px-4 py-3 mb-6 ${INTENT_BADGE[selected.intent]}`}>
                  <p className="text-sm font-medium">{INTENT_DOT[selected.intent]} Intent: {selected.intent}</p>
                  <p className="text-sm mt-1 opacity-80">{selected.intent_signal}</p>
                  {selected.intent_quote && <p className="text-xs mt-1 opacity-60 italic">"{selected.intent_quote}"</p>}
                </div>
              )}

              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex gap-2">
                    {emails.map((e, i) => (
                      <button key={e.id} onClick={() => setActiveEmail(i)}
                        className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${activeEmail === i ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white border border-gray-700'}`}>
                        Email {e.sequence_number}
                        {e.status === 'scheduled' ? ' ⏰' : e.status === 'sent' ? ' ✓' : ` (Day ${e.scheduled_day || 0})`}
                      </button>
                    ))}
                  </div>
                  <button onClick={handleRegenerate} disabled={regenerating}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                    {regenerating ? 'Regenerating...' : '↺ Regenerate'}
                  </button>
                </div>

                {currentEmail && (
                  <div className="bg-[#1a1d27] border border-gray-800 rounded-2xl p-5">
                    <EmailEditor key={currentEmail.id} email={currentEmail} onSaved={() => reload(selected?.id)} />
                    <div className="mt-4 pt-4 border-t border-gray-800 flex gap-2 items-center flex-wrap">
                      {currentEmail.status === 'scheduled' ? (
                        <>
                          <span className="text-violet-400 text-xs">
                            ⏰ Scheduled: {new Date(currentEmail.scheduled_at).toLocaleString([], {weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}
                          </span>
                          <button onClick={() => handleCancelSchedule(selected.id)}
                            className="text-gray-500 hover:text-red-400 text-xs border border-gray-700 px-3 py-1.5 rounded-lg transition-colors ml-auto">
                            Cancel schedule
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleSendEmail(currentEmail.id)}
                            disabled={sending || !!currentEmail.sent_at || !selected.email}
                            className={`text-sm px-4 py-2 rounded-lg transition-colors disabled:cursor-not-allowed
                              ${currentEmail.sent_at
                                ? 'bg-green-700/50 text-green-300 cursor-default'
                                : sending
                                ? 'bg-gray-800 text-gray-500'
                                : 'bg-yellow-600/70 hover:bg-yellow-600/90 text-yellow-100 font-medium'
                              }`}>
                            {currentEmail.sent_at ? 'Sent ✓' : sending ? 'Sending...' : 'Send now'}
                          </button>
                          {!selected.email && <p className="text-gray-500 text-xs">No contact email — copy & send manually</p>}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddProspectModal campaignId={id} onClose={() => setShowAddModal(false)} onAdded={() => reload(null)} />
      )}
      {showScheduleModal && (
        <ScheduleModal onClose={() => setShowScheduleModal(false)} onConfirm={handleSchedule} loading={scheduling} />
      )}
    </div>
  )
}
