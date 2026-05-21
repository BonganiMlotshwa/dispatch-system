const STORAGE_KEY = 'active_trucks';
const LEGACY_KEY = 'active_truck';

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
