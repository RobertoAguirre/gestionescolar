export const API_URL = import.meta.env.VITE_API_URL || 'https://gestionescolar-i55n.onrender.com';

export async function fetchAPI(path, options = {}) {
  const url = `${API_URL}${path}`;
  const token = localStorage.getItem('adminToken');
  const escuelaId = localStorage.getItem('escuelaId');

  const headers = { ...options.headers };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (escuelaId) {
    headers['X-Escuela-Id'] = escuelaId;
  }
  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  const res = await fetch(url, { ...options, headers });
  return res;
}
