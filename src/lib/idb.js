const DB_NAME = 'TPSH_ASSETS_DB';
const DB_VERSION = 1;
const STORE_NAME = 'student_photos';

function openDB() {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => {
        console.warn('IndexedDB open error:', e);
        resolve(null);
      };
    } catch (e) {
      console.warn('IndexedDB not supported or blocked:', e);
      resolve(null);
    }
  });
}

export async function savePhotoToIDB(studentId, photoData) {
  if (!studentId || !photoData) return false;
  try {
    const db = await openDB();
    if (!db) return false;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(photoData, String(studentId));
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export async function getPhotoFromIDB(studentId) {
  if (!studentId) return null;
  try {
    const db = await openDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(String(studentId));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function getAllPhotosFromIDB() {
  try {
    const db = await openDB();
    if (!db) return {};
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      const photos = {};
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          photos[cursor.key] = cursor.value;
          cursor.continue();
        } else {
          resolve(photos);
        }
      };
      req.onerror = () => resolve({});
    });
  } catch {
    return {};
  }
}
