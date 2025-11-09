/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { ConversationTurn, StoredImage, HostPersonality, VirtualSet } from './state';
import { HOST_PERSONALITIES } from './hosts';

const DB_NAME = 'PodcastSessionsDB';
const DB_VERSION = 3; // Incremented version to add new stores
const SESSIONS_STORE = 'sessions';
const HOSTS_STORE = 'hosts';
const VIRTUAL_SETS_STORE = 'virtualSets';
const KEY_VALUE_STORE = 'keyValueStore';


export interface SessionData {
  id: number; // timestamp
  date: string;
  podcastName: string;
  episodeTitle: string;
  channel: string;
  podcastFormat: string;
  sourceContext: string;
  mainTranscript: ConversationTurn[];
  fanTranscript: ConversationTurn[];
  judgeTranscript: ConversationTurn[];
  audioBlob?: Blob;
  micAudioBlob?: Blob;
  images: StoredImage[];
  status: 'complete' | 'incomplete';
  sessionConfig?: Record<string, any>; // To store a snapshot of all zustand stores
}

let db: IDBDatabase;

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Database error:', request.error);
      reject('Error opening database');
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        const store = db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
      }
      if (!db.objectStoreNames.contains(HOSTS_STORE)) {
        db.createObjectStore(HOSTS_STORE, { keyPath: 'name' });
      }
      if (!db.objectStoreNames.contains(VIRTUAL_SETS_STORE)) {
        db.createObjectStore(VIRTUAL_SETS_STORE, { keyPath: 'id' });
      }
       if (!db.objectStoreNames.contains(KEY_VALUE_STORE)) {
        db.createObjectStore(KEY_VALUE_STORE, { keyPath: 'key' });
      }
    };
  });
}

// Generic CRUD helpers
async function getAllFromStore<T>(storeName: string): Promise<T[]> {
    const db = await getDB();
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveOrUpdateInStore<T>(storeName: string, data: T): Promise<void> {
    const db = await getDB();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    store.put(data);
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

async function deleteFromStore(storeName: string, key: IDBValidKey): Promise<void> {
    const db = await getDB();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    store.delete(key);
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}


// --- SESSIONS ---
export async function saveOrUpdateSession(session: Omit<SessionData, 'date'>): Promise<void> {
  const sessionWithDate: SessionData = { ...session, date: new Date(session.id).toISOString() };
  await saveOrUpdateInStore(SESSIONS_STORE, sessionWithDate);
}
export async function getAllSessions(): Promise<SessionData[]> {
  const sessions = await getAllFromStore<SessionData>(SESSIONS_STORE);
  return sessions.filter(s => s.status === 'complete').sort((a, b) => b.id - a.id);
}
export async function findIncompleteSession(): Promise<SessionData | undefined> {
    const db = await getDB();
    const transaction = db.transaction(SESSIONS_STORE, 'readonly');
    const store = transaction.objectStore(SESSIONS_STORE);
    const statusIndex = store.index('status');
    const request = statusIndex.get('incomplete');
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
export async function getSession(id: number): Promise<SessionData | undefined> {
    const db = await getDB();
    const transaction = db.transaction(SESSIONS_STORE, 'readonly');
    const store = transaction.objectStore(SESSIONS_STORE);
    const request = store.get(id);
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
export async function deleteSession(id: number): Promise<void> {
  await deleteFromStore(SESSIONS_STORE, id);
}

// --- HOSTS ---
export const saveOrUpdateHost = (host: HostPersonality) => saveOrUpdateInStore(HOSTS_STORE, host);
export const getAllHosts = () => getAllFromStore<HostPersonality>(HOSTS_STORE);
export const deleteHost = (name: string) => deleteFromStore(HOSTS_STORE, name);

// --- VIRTUAL SETS ---
export const saveOrUpdateVirtualSet = (set: VirtualSet) => saveOrUpdateInStore(VIRTUAL_SETS_STORE, set);
export const getAllVirtualSets = () => getAllFromStore<VirtualSet>(VIRTUAL_SETS_STORE);
export const deleteVirtualSet = (id: string) => deleteFromStore(VIRTUAL_SETS_STORE, id);

// --- KEY-VALUE STORE ---
export async function getKV<T>(key: string): Promise<T | null> {
    const db = await getDB();
    const transaction = db.transaction(KEY_VALUE_STORE, 'readonly');
    const store = transaction.objectStore(KEY_VALUE_STORE);
    const request = store.get(key);
    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            resolve(request.result ? request.result.value : null);
        };
        request.onerror = () => reject(request.error);
    });
}

export async function setKV(key: string, value: any): Promise<void> {
    const db = await getDB();
    const transaction = db.transaction(KEY_VALUE_STORE, 'readwrite');
    const store = transaction.objectStore(KEY_VALUE_STORE);
    store.put({ key, value });
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

export async function delKV(key: string): Promise<void> {
    const db = await getDB();
    const transaction = db.transaction(KEY_VALUE_STORE, 'readwrite');
    const store = transaction.objectStore(KEY_VALUE_STORE);
    store.delete(key);
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}
