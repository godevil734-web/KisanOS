const API_BASE = '/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('kc_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Auth
  register: (data: any) => request<any>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: any) => request<any>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  demoSwitch: (role: string) => request<any>('/auth/demo-switch', { method: 'POST', body: JSON.stringify({ role }) }),
  getMe: () => request<any>('/auth/me'),

  // Crops
  getCrops: () => request<any[]>('/crops'),
  addCrop: (data: any) => request<any>('/crops', { method: 'POST', body: JSON.stringify(data) }),

  // Listings
  getListings: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<any[]>(`/listings${query ? `?${query}` : ''}`);
  },
  createListing: (data: any) => request<any>('/listings', { method: 'POST', body: JSON.stringify(data) }),
  verifyListing: (id: string) => request<any>(`/listings/${id}/verify`, { method: 'POST' }),

  // Requirements
  getRequirements: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<any[]>(`/requirements${query ? `?${query}` : ''}`);
  },
  createRequirement: (data: any) => request<any>('/requirements', { method: 'POST', body: JSON.stringify(data) }),

  // Matches
  getListingMatches: (listingId: string) => request<any>(`/matches/listing/${listingId}`),
  getRequirementMatches: (reqId: string) => request<any>(`/matches/requirement/${reqId}`),

  // Offers
  getOffers: () => request<any[]>('/offers'),
  createOffer: (data: any) => request<any>('/offers', { method: 'POST', body: JSON.stringify(data) }),
  updateOfferStatus: (id: string, status: string) => 
    request<any>(`/offers/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),

  // Orders
  getOrders: () => request<any[]>('/orders'),
  getOrder: (id: string) => request<any>(`/orders/${id}`),
  updateOrderStatus: (id: string, status: string, note?: string) => 
    request<any>(`/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, note }) }),

  // Aggregator
  getAggregatorProfile: () => request<any>('/aggregators/profile'),
  subscribeAggregator: (data: any) => request<any>('/aggregators/subscribe', { method: 'POST', body: JSON.stringify(data) }),

  // Batches
  getBatches: () => request<any[]>('/batches'),
  createBatch: (data: any) => request<any>('/batches', { method: 'POST', body: JSON.stringify(data) }),
  addFarmerToBatch: (batchId: string, data: any) => 
    request<any>(`/batches/${batchId}/add-farmer`, { method: 'POST', body: JSON.stringify(data) }),

  // Cold Storage
  getStorageFacilities: () => request<any[]>('/storage'),
  getStorageFacility: (id: string) => request<any>(`/storage/${id}`),
  bookStorage: (data: any) => request<any>('/storage/book', { method: 'POST', body: JSON.stringify(data) }),
  getMyStorageBookings: () => request<any[]>('/storage/bookings/my'),
  calculateStorageScenario: (data: any) => request<any>('/storage/scenario', { method: 'POST', body: JSON.stringify(data) }),

  // Transporters
  getTransporters: () => request<any[]>('/transporters'),
  calculateRoute: (data: any) => request<any>('/transporters/calculate-route', { method: 'POST', body: JSON.stringify(data) }),

  // Market Prices
  getMarketPrices: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<any[]>(`/market-prices${query ? `?${query}` : ''}`);
  },

  // Forecasts & AI
  getRegionalForecasts: () => request<any[]>('/forecasts/regional'),
  predictYield: (data: any) => request<any>('/forecasts/predict-yield', { method: 'POST', body: JSON.stringify(data) }),
  analyzeProduceCV: (data: any) => request<any>('/forecasts/cv-quality', { method: 'POST', body: JSON.stringify(data) }),

  // Admin
  getAdminStats: () => request<any>('/admin/stats'),
  getAdminUsers: () => request<any[]>('/admin/users'),
  toggleUserVerify: (userId: string) => request<any>(`/admin/users/${userId}/verify`, { method: 'PUT' }),
  getSubscriptionPlans: () => request<any[]>('/admin/plans'),
  updateSubscriptionPlan: (id: string, data: any) => request<any>(`/admin/plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  resetDemoData: () => request<any>('/admin/reset-demo', { method: 'POST' }),

  // Notifications
  getNotifications: () => request<any[]>('/notifications'),
  markNotificationRead: (id: string) => request<any>(`/notifications/${id}/read`, { method: 'PUT' })
};
