const viteApi = import.meta.env.VITE_API_URL;
const sameOrigin =
  import.meta.env.VITE_SAME_ORIGIN === 'true' || import.meta.env.VITE_SAME_ORIGIN === '1';

export const API_URL = (() => {
  if (viteApi != null && String(viteApi).length > 0) return viteApi;
  if (import.meta.env.DEV) return 'http://localhost:3000';
  if (sameOrigin) return '';
  return 'https://gestionescolar-i55n.onrender.com';
})();

export async function fetchAPI(path, options = {}) {
  const url = `${API_URL}${path}`;
  const token = localStorage.getItem('adminToken');
  const escuelaId = localStorage.getItem('escuelaId');
  const isAdminRoute = path.startsWith('/api/admin') || path.startsWith('/api/super-admin');

  const headers = { ...options.headers };
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (escuelaId && isAdminRoute && !headers['X-Escuela-Id']) {
    headers['X-Escuela-Id'] = escuelaId;
  }
  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  const res = await fetch(url, { ...options, headers });
  return res;
}
