import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const runCampaign = (data) => api.post('/campaigns/run/', data)
export const getCampaigns = () => api.get('/campaigns/')
export const getCampaign = (id) => api.get(`/campaigns/${id}/`)
export const deleteCampaign = (id) => api.delete(`/campaigns/${id}/`)
export const getProspects = (campaignId) => api.get(`/campaigns/${campaignId}/prospects/`)
export const updateProspect = (id, data) => api.patch(`/prospects/${id}/`, data)
export const updateEmail = (id, data) => api.patch(`/emails/${id}/`, data)
export const sendEmail = (emailId) => api.post(`/emails/${emailId}/send/`)
export const regenerateEmails = (prospectId) => api.post(`/prospects/${prospectId}/regenerate-emails/`)
export const deleteProspect = (id) => api.delete(`/prospects/${id}/`)
export const addProspect = (campaignId, data) => api.post(`/campaigns/${campaignId}/prospects/`, data)
export const scheduleCampaign = (campaignId, settings) => api.post(`/campaigns/${campaignId}/schedule/`, settings)
export const cancelSchedule = (prospectId) => api.post(`/prospects/${prospectId}/cancel-schedule/`)
export const cancelCampaignSchedule = (campaignId) => api.post(`/campaigns/${campaignId}/cancel-schedule/`)
export const scrapeUrl = (url) => api.post('/scrape-url/', { url })
