import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCampaigns, deleteCampaign } from '../api'

export default function Dashboard() {
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCampaigns().then(r => setCampaigns(r.data)).finally(() => setLoading(false))
  }, [])

  async function handleDelete(id) {
    if (!confirm('Delete this campaign?')) return
    await deleteCampaign(id)
    setCampaigns(c => c.filter(x => x.id !== id))
  }

  return (
    <div className="min-h-screen bg-[#0f1117] px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Campaigns</h1>
            <p className="text-gray-400 text-sm mt-1">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="bg-violet-600 hover:bg-violet-500 text-white font-medium px-5 py-2.5 rounded-xl transition-colors"
          >
            + New Campaign
          </button>
        </div>

        {loading ? (
          <div className="text-gray-500 text-center py-20">Loading...</div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 mb-4">No campaigns yet</p>
            <button onClick={() => navigate('/')} className="text-violet-400 hover:text-violet-300 transition-colors">
              Create your first campaign →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map(c => (
              <div
                key={c.id}
                className="bg-[#1a1d27] border border-gray-800 rounded-2xl px-6 py-5 flex items-center justify-between hover:border-gray-700 transition-colors cursor-pointer"
                onClick={() => navigate(`/campaigns/${c.id}`)}
              >
                <div>
                  <p className="text-white font-medium">{c.name}</p>
                  <p className="text-gray-400 text-sm mt-1 truncate max-w-lg">{c.query}</p>
                  <p className="text-gray-600 text-xs mt-1">{new Date(c.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-violet-400 font-semibold">{c.prospect_count} prospects</span>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(c.id) }}
                    className="text-gray-600 hover:text-red-400 transition-colors text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
