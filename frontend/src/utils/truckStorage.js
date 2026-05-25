import axios from 'axios';
import { API_BASE_URL } from '../config';

const STORAGE_KEY = 'active_trucks';
const LEGACY_KEY = 'active_truck';

/** Merge API open trucks with this browser's session list (dedupe by id). */
export function mergeOpenTruckLists(apiTrucks = [], localTrucks = []) {
  const byId = new Map();
  [...apiTrucks, ...localTrucks].forEach((t) => {
    if (!t?.id) return;
    const id = Number(t.id);
    byId.set(id, { ...byId.get(id), ...t, id });
  });
  return Array.from(byId.values()).sort((a, b) => Number(b.id) - Number(a.id));
}

/** Fetch unfinished trucks from the server (works across devices / after park). */
export async function fetchOpenTrucks() {
  try {
    const res = await axios.get(`${API_BASE_URL}/active_trucks.php`);
    if (res.data?.success && Array.isArray(res.data.trucks)) {
      return res.data.trucks;
    }
  } catch (_) {
    /* fall through */
  }
  return [];
}

export function getActiveTrucks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const truck = JSON.parse(legacy);
      const list = truck?.id ? [truck] : [];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      localStorage.removeItem(LEGACY_KEY);
      return list;
    }
  } catch (_) {
    /* ignore */
  }
  return [];
}

export function saveActiveTrucks(trucks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trucks));
  if (trucks.length > 0) {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(trucks[trucks.length - 1]));
  } else {
    localStorage.removeItem(LEGACY_KEY);
  }
}

export function addActiveTruck(truck) {
  const list = getActiveTrucks();
  if (list.some((t) => t.id === truck.id)) {
    return list;
  }
  const next = [...list, truck];
  saveActiveTrucks(next);
  return next;
}

export function removeActiveTruck(truckId) {
  const next = getActiveTrucks().filter((t) => t.id !== truckId);
  saveActiveTrucks(next);
  return next;
}

export function clearActiveTrucks() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_KEY);
}
