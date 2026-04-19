import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { runCampaign, scrapeUrl } from '../api'
import logo from '../assets/logo.svg'

const TONES = ['casual', 'formal', 'technical']
const TONE_META = {
  casual:    { label: 'Casual',    desc: 'Friendly & conversational' },
  formal:    { label: 'Formal',    desc: 'Professional & polished'   },
  technical: { label: 'Technical', desc: 'Data-driven & precise'     },
}

function AnimatedBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-[#080a12]" />

      {/* Glow orbs */}
      <div className="absolute top-[-10%] left-[25%] w-[700px] h-[700px] rounded-full bg-violet-700/10 blur-[140px]" />
      <div className="absolute bottom-[-15%] right-[15%] w-[500px] h-[500px] rounded-full bg-indigo-700/8 blur-[120px]" />

      {/* Dot grid */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="rgba(139,92,246,0.18)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots)" />
      </svg>

      {/* Pulsing bright dots */}
      {[
        { x: '18%', y: '22%', delay: '0s',   dur: '3s'   },
        { x: '72%', y: '15%', delay: '0.8s', dur: '3.5s' },
        { x: '85%', y: '55%', delay: '1.4s', dur: '4s'   },
        { x: '35%', y: '78%', delay: '0.4s', dur: '2.8s' },
        { x: '60%', y: '70%', delay: '2s',   dur: '3.2s' },
        { x: '10%', y: '60%', delay: '1s',   dur: '3.8s' },
      ].map((d, i) => (
        <div key={i} className="absolute w-1 h-1 rounded-full bg-violet-400"
          style={{ left: d.x, top: d.y, boxShadow: '0 0 6px 2px rgba(139,92,246,0.5)',
            animation: `pulse ${d.dur} ease-in-out infinite`, animationDelay: d.delay }} />
      ))}

      {/* Flowing wave lines */}
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        {[
          { d: "M-100,250 C200,150 400,350 700,200 S1100,100 1500,220", dur: '12s', op: 0.12 },
          { d: "M-100,380 C150,280 350,450 650,320 S1050,250 1500,350", dur: '15s', op: 0.08 },
          { d: "M-100,520 C250,420 500,580 800,460 S1200,380 1500,500", dur: '18s', op: 0.06 },
          { d: "M-100,150 C300,80  550,250 850,130 S1200,60  1500,160", dur: '20s', op: 0.05 },
        ].map((w, i) => (
          <path key={i} d={w.d} fill="none" stroke={`rgba(139,92,246,${w.op})`} strokeWidth="1.5">
            <animateTransform attributeName="transform" type="translate" values="0,0; 0,-30; 0,0"
              dur={w.dur} repeatCount="indefinite" />
          </path>
        ))}
      </svg>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.8); }
        }
      `}</style>
    </div>
  )
}

export default function NewCampaign() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    query: '',
    product_url: '',
    tone: 'casual',
    name: '',
    sender_name: '',
    sender_designation: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState('')

  const steps = [
    'Fetching product context from website...',
    'Translating query with Gemini...',
    'Searching companies on Crustdata...',
    'Finding prospects...',
    'Enriching profiles...',
    'Detecting intent signals...',
    'Generating personalised emails...',
  ]

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    let i = 0
    const interval = setInterval(() => { setStep(steps[i % steps.length]); i++ }, 2500)
    try {
      let product_context = ''
      if (form.product_url.trim()) {
        setStep('Fetching product context from website...')
        const scraped = await scrapeUrl(form.product_url.trim())
        product_context = scraped.data.product_context
      }
      const res = await runCampaign({ ...form, product_context })
      clearInterval(interval)
      navigate(`/campaigns/${res.data.campaign.id}`)
    } catch (err) {
      clearInterval(interval)
      setError(err.response?.data?.error || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/60 focus:bg-white/8 transition-all text-sm backdrop-blur-sm"

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 py-12 overflow-hidden">
      <AnimatedBackground />

      <div className="relative z-10 w-full max-w-xl">

        {/* Hero */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <img src={logo} alt="ProspectAI" className="w-12 h-12 drop-shadow-[0_0_12px_rgba(139,92,246,0.6)]" />
            <h1 className="text-5xl font-bold text-white tracking-tight">
              Prospect<span className="text-violet-400">AI</span>
            </h1>
          </div>
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/25 rounded-full px-4 py-1.5 mt-3 mb-4 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            <span className="text-violet-400 text-xs font-medium tracking-widest uppercase">Autonomous SDR Agent</span>
          </div>
          <p className="text-gray-500 text-sm leading-relaxed">
            Describe who you want to reach — we'll find them,<br />enrich them, and write the emails.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden">

          {/* Sender strip */}
          <div className="border-b border-white/8 px-6 py-4 grid grid-cols-2 gap-4 bg-white/[0.02]">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-widest">Your name</label>
              <input className={inputCls} placeholder="Jai"
                value={form.sender_name} onChange={e => setForm({ ...form, sender_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-widest">Designation</label>
              <input className={inputCls} placeholder="Founder & CEO, Geolayer"
                value={form.sender_designation} onChange={e => setForm({ ...form, sender_designation: e.target.value })} />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">

            {/* Query */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-widest">Who are you looking for?</label>
              <textarea className={`${inputCls} resize-none leading-relaxed`} rows={3}
                placeholder='e.g. "Find 20 Directors at mid-size geotechnical firms in Australia talking about data management"'
                value={form.query} onChange={e => setForm({ ...form, query: e.target.value })} required />
            </div>

            {/* Product URL */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-widest">Company website</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 text-sm select-none">🌐</span>
                <input className={`${inputCls} pl-10`} placeholder="https://yourcompany.com"
                  value={form.product_url} onChange={e => setForm({ ...form, product_url: e.target.value })} />
              </div>
              <p className="text-gray-600 text-xs mt-1.5 ml-1">Scraped automatically to personalise every email.</p>
            </div>

            {/* Tone */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-widest">Email tone</label>
              <div className="grid grid-cols-3 gap-2">
                {TONES.map(t => (
                  <button key={t} type="button" onClick={() => setForm({ ...form, tone: t })}
                    className={`rounded-xl px-3 py-2.5 text-left transition-all border ${
                      form.tone === t
                        ? 'bg-violet-600/20 border-violet-500/60 text-white shadow-lg shadow-violet-900/20'
                        : 'bg-white/[0.03] border-white/8 text-gray-400 hover:border-white/20 hover:text-gray-300'
                    }`}>
                    <p className="text-sm font-medium">{TONE_META[t].label}</p>
                    <p className="text-xs opacity-50 mt-0.5">{TONE_META[t].desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Campaign name */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-widest">
                Campaign name <span className="normal-case text-gray-700 font-normal">(optional)</span>
              </label>
              <input className={inputCls} placeholder="e.g. Geolayer — AU Geotechs Q2"
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>

            {error && (
              <div className="bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-3 text-red-400 text-sm backdrop-blur-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full relative bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3.5 transition-all text-sm shadow-lg shadow-violet-900/40 overflow-hidden group">
              <span className="absolute inset-0 bg-gradient-to-r from-violet-600 via-violet-500 to-violet-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative flex items-center justify-center gap-2.5">
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    {step || 'Running pipeline...'}
                  </>
                ) : (
                  <>
                    Find Prospects
                    <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </>
                )}
              </span>
            </button>
          </form>
        </div>

        <button onClick={() => navigate('/campaigns')}
          className="mt-5 w-full text-center text-gray-700 hover:text-gray-500 text-sm transition-colors flex items-center justify-center gap-1.5">
          View all campaigns
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
