import axios from 'axios';
import { API_BASE_URL } from '../config';

const STORAGE_KEY = 'auth_user';

export function getUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isLoggedIn() {
  return !!getUser();
}

export async function login(username, password) {
  try {
    const res = await axios.post(
      `${API_BASE_URL}/auth/login.php`,
      { username, password },
      { withCredentials: true, timeout: 10000 }
    );
    if (res.data?.success && res.data?.user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(res.data.user));
      try { window.dispatchEvent(new CustomEvent('auth-changed', { detail: { loggedIn: true } })); } catch {}
      return res.data.user;
    }
    throw new Error(res.data?.message || 'Login failed');
  } catch (err) {
    const message = err?.response?.data?.message || err.message || 'Login failed';
    throw new Error(message);
  }
}

export async function logout() {
  try {
    await axios.post(`${API_BASE_URL}/auth/logout.php`, {}, { withCredentials: true });
  } catch {}
  localStorage.removeItem(STORAGE_KEY);
  try { window.dispatchEvent(new CustomEvent('auth-changed', { detail: { loggedIn: false } })); } catch {}
}


