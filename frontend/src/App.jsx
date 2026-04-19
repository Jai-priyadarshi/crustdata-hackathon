import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import NewCampaign from './pages/NewCampaign'
import Dashboard from './pages/Dashboard'
import CampaignDetail from './pages/CampaignDetail'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<NewCampaign />} />
        <Route path="/campaigns" element={<Dashboard />} />
        <Route path="/campaigns/:id" element={<CampaignDetail />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}
