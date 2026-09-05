const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const getStoredTokens = () => {
  return {
    accessToken: localStorage.getItem('habitup_access_token'),
    refreshToken: localStorage.getItem('habitup_refresh_token'),
  };
};

export const storeTokens = (accessToken, refreshToken) => {
  if (accessToken) localStorage.setItem('habitup_access_token', accessToken);
  if (refreshToken) localStorage.setItem('habitup_refresh_token', refreshToken);
};

export const clearTokens = () => {
  localStorage.removeItem('habitup_access_token');
  localStorage.removeItem('habitup_refresh_token');
  localStorage.removeItem('habitup_admin_user');
};

export async function apiRequest(endpoint, options = {}) {
  const { accessToken } = getStoredTokens();
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle Token Rotation on 401 Unauthorized
  if (response.status === 401 && !options._isRetry) {
    const { refreshToken } = getStoredTokens();
    if (refreshToken && endpoint !== '/auth/login' && endpoint !== '/auth/refresh') {
      try {
        const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          storeTokens(refreshData.accessToken, refreshData.refreshToken);

          // Retry original request with new token
          headers['Authorization'] = `Bearer ${refreshData.accessToken}`;
          response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            _isRetry: true,
            headers,
          });
        } else {
          clearTokens();
          window.location.reload();
        }
      } catch (err) {
        clearTokens();
        window.location.reload();
      }
    }
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || data.message || `HTTP ${response.status} Error`;
    throw new Error(errorMsg);
  }

  return data;
}

// API Methods
export const api = {
  async login(email, password) {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return data;
  },

  async heartbeat(refreshToken) {
    return apiRequest('/auth/session/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  },

  async getDashboardMetrics(period = '7d') {
    return apiRequest(`/admin/dashboard?period=${encodeURIComponent(period)}`);
  },

  async getUsersList(params = {}) {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    if (params.email) query.append('email', params.email);
    if (params.role) query.append('role', params.role);
    if (params.status) query.append('status', params.status);
    if (params.sort) query.append('sort', params.sort);
    if (params.order) query.append('order', params.order);

    return apiRequest(`/admin/users?${query.toString()}`);
  },

  async getUserDetail(userId) {
    return apiRequest(`/admin/users/${encodeURIComponent(userId)}`);
  },

  async getActivityFeed(params = {}) {
    const query = new URLSearchParams();
    if (params.userId) query.append('userId', params.userId);
    if (params.activityType) query.append('activityType', params.activityType);
    if (params.from) query.append('from', params.from);
    if (params.to) query.append('to', params.to);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);

    return apiRequest(`/admin/activity?${query.toString()}`);
  },

  async getUsageAnalytics(params = {}) {
    const query = new URLSearchParams();
    if (params.period) query.append('period', params.period);
    if (params.from) query.append('from', params.from);
    if (params.to) query.append('to', params.to);

    return apiRequest(`/admin/analytics/usage?${query.toString()}`);
  },

  async getActivityAnalytics(params = {}) {
    const query = new URLSearchParams();
    if (params.period) query.append('period', params.period);
    if (params.from) query.append('from', params.from);
    if (params.to) query.append('to', params.to);

    return apiRequest(`/admin/analytics/activity?${query.toString()}`);
  },
};
