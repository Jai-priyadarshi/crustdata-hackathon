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
export const scrapeUrl = (url) => api.post('/scrape-url/', { url })
