// IndexedDB cache for large asteroid files (too big for localStorage).
// Stores the raw ArrayBuffer keyed by source ('JPL-num' or 'JPL-unnum').

const DB_NAME = 'tns-orbitals';
const DB_VERSION = 1;
const STORE = 'asteroid-raw';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => e.target.result.createObjectStore(STORE);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function saveAsteroidRaw(source, buf) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ source, buf }, source);
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}

export async function loadAsteroidRaw(source) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(source);
    req.onsuccess = (e) => resolve(e.target.result ?? null);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function clearAsteroidRaw(source) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(source);
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });
}
