import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { runCampaign } from '../api'

const TONES = ['casual', 'formal', 'technical']

export default function NewCampaign() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    query: '',
    product_context: '',
    tone: 'casual',
    name: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState('')

  const steps = [
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
    const interval = setInterval(() => {
      setStep(steps[i % steps.length])
      i++
    }, 2500)

    try {
      const res = await runCampaign(form)
      clearInterval(interval)
      navigate(`/campaigns/${res.data.campaign.id}`)
    } catch (err) {
      clearInterval(interval)
      setError(err.response?.data?.error || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">ProspectAI</h1>
          <p className="text-gray-400">Autonomous SDR agent powered by Crustdata × Gemini</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#1a1d27] rounded-2xl p-8 border border-gray-800 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Describe your ideal prospect
            </label>
            <textarea
              className="w-full bg-[#0f1117] border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 resize-none"
              rows={3}
              placeholder='e.g. "Find 20 Directors at mid-size geotechnical firms in Australia who are talking about data management"'
              value={form.query}
              onChange={e => setForm({ ...form, query: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Your product context
            </label>
            <textarea
              className="w-full bg-[#0f1117] border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 resize-none"
              rows={3}
              placeholder='e.g. "Geolayer — AI tool that extracts borehole log data from PDFs into Excel/AGS automatically"'
              value={form.product_context}
              onChange={e => setForm({ ...form, product_context: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Campaign name</label>
              <input
                className="w-full bg-[#0f1117] border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500"
                placeholder="Optional"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email tone</label>
              <select
                className="w-full bg-[#0f1117] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500"
                value={form.tone}
                onChange={e => setForm({ ...form, tone: e.target.value })}
              >
                {TONES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-violet-900 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-4 transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                {step || 'Running pipeline...'}
              </span>
            ) : 'Find Prospects'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button onClick={() => navigate('/campaigns')} className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
            View all campaigns →
          </button>
        </div>
      </div>
    </div>
  )
}
