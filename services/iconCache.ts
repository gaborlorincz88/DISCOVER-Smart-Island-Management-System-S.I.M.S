// Simple Icon Cache using IndexedDB for mobile persistence
const DB_NAME = 'icon_cache';
const DB_VERSION = 1;
const STORE_NAME = 'icons';

let db: IDBDatabase | null = null;

interface CachedIcon {
  url: string;
  base64: string;
  timestamp: number;
}

async function getDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'url' });
      }
    };
  });
}

export async function getCachedIcon(url: string): Promise<string | null> {
  try {
    const database = await getDB();
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(url);

    const result = await new Promise<any>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });

    // Cache valid for 7 days
    if (result && Date.now() - result.timestamp < 7 * 24 * 60 * 60 * 1000) {
      return result.base64;
    }
    return null;
  } catch (error) {
    console.error('IndexedDB get error:', error);
    return null;
  }
}

// Batch get all cached icons for faster loading
export async function getAllCachedIcons(urls: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  
  try {
    const database = await getDB();
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    // Get all in parallel
    const promises = urls.map(url => 
      new Promise<{url: string, data: string | null}>((resolve) => {
        const request = store.get(url);
        request.onsuccess = () => {
          const cached = request.result;
          if (cached && Date.now() - cached.timestamp < 7 * 24 * 60 * 60 * 1000) {
            resolve({ url, data: cached.base64 });
          } else {
            resolve({ url, data: null });
          }
        };
        request.onerror = () => resolve({ url, data: null });
      })
    );
    
    const results = await Promise.all(promises);
    results.forEach(({ url, data }) => {
      if (data) result.set(url, data);
    });
  } catch (error) {
    console.error('IndexedDB batch get error:', error);
  }
  
  return result;
}

export async function cacheIcon(url: string, base64: string): Promise<void> {
  try {
    const database = await getDB();
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const data: CachedIcon = {
      url,
      base64,
      timestamp: Date.now()
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('IndexedDB put error:', error);
  }
}

export function imageToBase64(img: HTMLImageElement): string {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/png');
  }
  return '';
}

