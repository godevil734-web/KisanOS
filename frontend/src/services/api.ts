function resolveApiBase(): string {
  let base = (import.meta as any).env?.VITE_API_BASE || '/api';
  if (base && !base.startsWith('http') && !base.startsWith('/')) {
    base = `https://${base}`;
  }
  if (base.endsWith('/')) {
    base = base.slice(0, -1);
  }
  if (base.startsWith('http') && !base.endsWith('/api')) {
    base = `${base}/api`;
  }
  return base;
}

const API_BASE = resolveApiBase();

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
    credentials: 'include',
    ...options,
    headers
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
    const err: any = new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
    err.code = errorData.error;
    throw err;
  }

  return response.json();
}

export const api = {
  // Auth
  sendOtp: (identifier: string) => 
    request<any>('/auth/otp/send', { 
      method: 'POST', 
      body: JSON.stringify(identifier.includes('@') ? { email: identifier } : { phone: identifier }) 
    }),
  sendEmailOtp: (email: string) =>
    request<any>('/auth/send-email-otp', { method: 'POST', body: JSON.stringify({ email }) }),
  verifyOtp: (data: { phone?: string; email?: string; code: string; otp?: string; expectedRole?: string }) => 
    request<any>('/auth/otp/verify', { method: 'POST', body: JSON.stringify(data) }),
  verifyEmailOtp: (data: { email: string; otp: string; expectedRole?: string }) =>
    request<any>('/auth/verify-email-otp', { method: 'POST', body: JSON.stringify(data) }),
  initSignup: (data: any) =>
    request<any>('/auth/signup/init', { method: 'POST', body: JSON.stringify(data) }),
  resendSignupOtp: (signupToken: string) =>
    request<any>('/auth/signup/resend', { method: 'POST', body: JSON.stringify({ signupToken }) }),
  verifySignup: (data: { signupToken: string; code: string }) =>
    request<any>('/auth/signup/verify', { method: 'POST', body: JSON.stringify(data) }),
  signupFarmer: (data: { name: string; phone: string; villageDistrict: string; mainCrops: string[]; password?: string }) =>
    request<any>('/auth/signup/farmer', { method: 'POST', body: JSON.stringify(data) }),
  signupBusiness: (data: { role: string; businessName: string; contactPerson: string; mobile: string; email: string; city: string; password: string }) =>
    request<any>('/auth/signup/business', { method: 'POST', body: JSON.stringify(data) }),
  googleInit: (data: { credential?: string; googleUser?: any }) =>
    request<any>('/auth/google/init', { method: 'POST', body: JSON.stringify(data) }),
  googleVerifyOtp: (data: { tempToken: string; code: string }) =>
    request<any>('/auth/google/verify-otp', { method: 'POST', body: JSON.stringify(data) }),
  googleRegister: (data: any) =>
    request<any>('/auth/google/register', { method: 'POST', body: JSON.stringify(data) }),
  googleResendOtp: (email: string) =>
    request<any>('/auth/google/resend-otp', { method: 'POST', body: JSON.stringify({ email }) }),
  login: (data: any) => request<any>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request<any>('/auth/logout', { method: 'POST' }),
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
  updateListingStatus: (id: string, status: string) => 
    request<any>(`/listings/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

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
  getSentOffers: () => request<any[]>('/offers/sent'),
  getIncomingOffers: () => request<any[]>('/offers/incoming'),
  createOffer: (data: any) => request<any>('/offers', { method: 'POST', body: JSON.stringify(data) }),
  acceptOffer: (id: string) => request<any>(`/offers/${id}/accept`, { method: 'POST' }),
  counterOffer: (id: string, data: { counterPricePerKg: number; counterQuantityTons: number; pickupTerms?: string; deliveryTerms?: string; targetDate?: string; date?: string; message?: string }) => 
    request<any>(`/offers/${id}/counter`, { method: 'POST', body: JSON.stringify(data) }),
  rejectOffer: (id: string, reason?: string) => 
    request<any>(`/offers/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  updateOfferStatus: (id: string, status: string) => 
    request<any>(`/offers/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),

  // Orders & Deals
  getOrders: () => request<any[]>('/orders'),
  getOrder: (id: string) => request<any>(`/orders/${id}`),
  getDeals: () => request<any[]>('/deals'),
  getDeal: (id: string) => request<any>(`/deals/${id}`),
  updateOrderStatus: (id: string, status: string, note?: string) => 
    request<any>(`/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, note }) }),

  // Aggregator
  getAggregatorProfile: () => request<any>('/aggregators/profile'),
  subscribeAggregator: (data: any) => request<any>('/aggregators/subscribe', { method: 'POST', body: JSON.stringify(data) }),

  // Supply Network & Procurement
  getNearbyBuyers: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<any[]>(`/buyers/nearby${query ? `?${query}` : ''}`);
  },
  getNearbyFarmerSupply: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<any[]>(`/farmer-supply/nearby${query ? `?${query}` : ''}`);
  },
  getAggregatorDemand: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<any[]>(`/aggregator/demand${query ? `?${query}` : ''}`);
  },
  getAggregatorSupply: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<any[]>(`/aggregator/supply${query ? `?${query}` : ''}`);
  },
  getProcurementPlans: () => request<any[]>('/aggregator/procurement-plans'),
  createProcurementPlan: (data: any) => 
    request<any>('/aggregator/procurement-plans', { method: 'POST', body: JSON.stringify(data) }),
  updateProcurementPlan: (id: string, data: any) => 
    request<any>(`/aggregator/procurement-plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  createBatchFromPlan: (id: string, data: any = {}) => 
    request<any>(`/aggregator/procurement-plans/${id}/create-batch`, { method: 'POST', body: JSON.stringify(data) }),

  // AI Recommendation
  getAiBuyerRecommendation: (data: any) => 
    request<any>('/ai/buyer-recommendation', { method: 'POST', body: JSON.stringify(data) }),
  sendKisanSaathiMessage: (data: { message: string; history?: any[] }) =>
    request<any>('/ai/kisan-saathi/chat', { method: 'POST', body: JSON.stringify(data) }),

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

  // Real Government Mandi Prices (Agmarknet & data.gov.in)
  getMandiLocations: () => request<{ success: boolean; states: MandiLocationState[] }>('/mandi-locations'),
  getMandiPrices: (params: { state: string; district?: string; commodity?: string; date?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params.state) q.append('state', params.state);
    if (params.district) q.append('district', params.district);
    if (params.commodity) q.append('commodity', params.commodity);
    if (params.date) q.append('date', params.date);
    if (params.limit) q.append('limit', String(params.limit));
    return request<MandiPricesResponse>(`/mandi-prices?${q.toString()}`);
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
  resetDemoData: () => request<any>('/admin/reset-demo', { method: 'POST', body: JSON.stringify({ confirm: 'RESET_DEMO' }) }),
  getPendingApprovals: () => request<any[]>('/admin/pending-approvals'),
  approveUser: (userId: string) => request<any>(`/admin/users/${userId}/approve`, { method: 'POST' }),
  rejectUser: (userId: string, reason?: string) => request<any>(`/admin/users/${userId}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  blockUser: (userId: string) => request<any>(`/admin/users/${userId}/block`, { method: 'POST' }),
  unblockUser: (userId: string) => request<any>(`/admin/users/${userId}/unblock`, { method: 'POST' }),
  makeUserAdmin: (userId: string) => request<any>(`/admin/users/${userId}/make-admin`, { method: 'POST' }),
  deleteUser: (userId: string) => request<any>(`/admin/users/${userId}`, { method: 'DELETE' }),
  bulkApproveUsers: (userIds: string[]) => request<{ success: boolean; message: string; approvedCount: number }>('/admin/users/bulk-approve', { method: 'POST', body: JSON.stringify({ userIds }) }),
  bulkDeleteUsers: (userIds: string[]) => request<{ success: boolean; message: string; deletedCount: number }>('/admin/users/bulk-delete', { method: 'POST', body: JSON.stringify({ userIds }) }),
  updateUserRole: (userId: string, role: string) => request<any>(`/admin/users/${userId}/role`, { method: 'POST', body: JSON.stringify({ role }) }),
  revealUserPhone: (userId: string) => request<{ id: string; phone: string }>(`/admin/users/${userId}/reveal-phone`, { method: 'POST' }),
  getAuditLogs: (params: { action?: string; limit?: number | string; offset?: number | string } = {}) => {
    const cleanParams: Record<string, string> = {};
    if (params.action) cleanParams.action = params.action;
    if (params.limit !== undefined) cleanParams.limit = String(params.limit);
    if (params.offset !== undefined) cleanParams.offset = String(params.offset);
    const query = new URLSearchParams(cleanParams).toString();
    return request<any[]>(`/admin/audit-logs${query ? `?${query}` : ''}`);
  },

  // Notifications
  getNotifications: () => request<any[]>('/notifications'),
  markNotificationRead: (id: string) => request<any>(`/notifications/${id}/read`, { method: 'PUT' }),

  // NaLamKI / ITU-T Digital Farm Activity & Traceability (Annex A.16)
  getActivities: (params: Record<string, string> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<any[]>(`/activities${query ? `?${query}` : ''}`);
  },
  getActivityById: (id: string) => request<any>(`/activities/${id}`),
  createActivity: (data: any) => request<any>('/activities', { method: 'POST', body: JSON.stringify(data) }),
  updateActivity: (id: string, data: any) => request<any>(`/activities/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteActivity: (id: string) => request<any>(`/activities/${id}`, { method: 'DELETE' }),
  getListingTraceability: (listingId: string) => request<any>(`/listings/${listingId}/traceability`),
  getNaLamKIManifest: () => request<any>('/activities/standards/nalamki-manifest')
};

export interface MandiLocationState {
  id: number;
  state_name: string;
  districts: string[];
}

export interface MandiPriceRecord {
  id: string;
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety: string;
  group?: string;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  modalPricePerKg: string;
  unit: string;
  arrivals?: number | null;
  arrivalsUnit?: string;
  arrivalDate: string;
  source: string;
}

export interface MandiCommoditySummary {
  commodity: string;
  group: string;
  avgModalPrice: number;
  avgPricePerKg: string;
  priceRange: string;
  lowestPrice: number;
  highestPrice: number;
  reportingMandisCount: number;
  totalArrivals?: number | null;
  arrivalsUnit?: string;
}

export interface MandiPricesResponse {
  success: boolean;
  source: string;
  reportDate: string;
  state: string;
  district: string;
  totalRecords: number;
  distinctCommoditiesCount: number;
  commoditySummaries: MandiCommoditySummary[];
  records: MandiPriceRecord[];
  lastUpdated: string;
  error?: string;
  message?: string;
}
