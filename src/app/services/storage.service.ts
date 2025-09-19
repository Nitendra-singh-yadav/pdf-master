import { Injectable } from '@angular/core';

export interface StorageConfig {
  dbName: string;
  version: number;
  stores: StoreConfig[];
}

export interface StoreConfig {
  name: string;
  keyPath: string;
  indexes?: IndexConfig[];
}

export interface IndexConfig {
  name: string;
  keyPath: string | string[];
  unique?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'PdfMasterStorage';
  private readonly version = 1;

  private readonly config: StorageConfig = {
    dbName: this.dbName,
    version: this.version,
    stores: [
      {
        name: 'projects',
        keyPath: 'id',
        indexes: [
          { name: 'createdAt', keyPath: 'createdAt' },
          { name: 'updatedAt', keyPath: 'updatedAt' },
          { name: 'tags', keyPath: 'tags' },
          { name: 'isStarred', keyPath: 'isStarred' }
        ]
      },
      {
        name: 'documents',
        keyPath: 'id',
        indexes: [
          { name: 'projectId', keyPath: 'projectId' },
          { name: 'createdAt', keyPath: 'createdAt' },
          { name: 'type', keyPath: 'type' },
          { name: 'status', keyPath: 'status' },
          { name: 'isStarred', keyPath: 'isStarred' }
        ]
      },
      {
        name: 'scans',
        keyPath: 'id',
        indexes: [
          { name: 'projectId', keyPath: 'projectId' },
          { name: 'documentId', keyPath: 'documentId' },
          { name: 'createdAt', keyPath: 'createdAt' },
          { name: 'captureMethod', keyPath: 'captureMethod' },
          { name: 'isProcessed', keyPath: 'isProcessed' }
        ]
      },
      {
        name: 'files',
        keyPath: 'id',
        indexes: [
          { name: 'documentId', keyPath: 'documentId' },
          { name: 'scanId', keyPath: 'scanId' },
          { name: 'createdAt', keyPath: 'createdAt' }
        ]
      },
      {
        name: 'preferences',
        keyPath: 'key'
      }
    ]
  };

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve();
        return;
      }

      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error('Failed to open database'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;

        // Create object stores
        for (const storeConfig of this.config.stores) {
          if (!db.objectStoreNames.contains(storeConfig.name)) {
            const store = db.createObjectStore(storeConfig.name, {
              keyPath: storeConfig.keyPath,
              autoIncrement: storeConfig.keyPath === 'id' ? false : true
            });

            // Create indexes
            if (storeConfig.indexes) {
              for (const indexConfig of storeConfig.indexes) {
                store.createIndex(
                  indexConfig.name,
                  indexConfig.keyPath,
                  { unique: indexConfig.unique || false }
                );
              }
            }
          }
        }
      };
    });
  }

  // Generic CRUD operations
  async create<T>(storeName: string, data: T): Promise<T> {
    await this.ensureConnection();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(data);

      request.onsuccess = () => resolve(data);
      request.onerror = () => reject(request.error);
    });
  }

  async read<T>(storeName: string, key: string): Promise<T | null> {
    await this.ensureConnection();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async update<T>(storeName: string, data: T): Promise<T> {
    await this.ensureConnection();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve(data);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName: string, key: string): Promise<void> {
    await this.ensureConnection();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async list<T>(storeName: string): Promise<T[]> {
    await this.ensureConnection();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async query<T>(
    storeName: string,
    indexName: string,
    value: any,
    direction: IDBCursorDirection = 'next'
  ): Promise<T[]> {
    await this.ensureConnection();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.openCursor(IDBKeyRange.only(value), direction);
      const results: T[] = [];

      request.onsuccess = (event: any) => {
        const cursor = event.target.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async count(storeName: string, indexName?: string, value?: any): Promise<number> {
    await this.ensureConnection();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);

      let request: IDBRequest;
      if (indexName && value !== undefined) {
        const index = store.index(indexName);
        request = index.count(IDBKeyRange.only(value));
      } else {
        request = store.count();
      }

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Specialized methods for file storage
  async storeFile(id: string, file: File, associatedId: string, type: 'document' | 'scan'): Promise<void> {
    const fileData = {
      id,
      [`${type}Id`]: associatedId,
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      data: await this.fileToArrayBuffer(file),
      createdAt: new Date()
    };

    await this.create('files', fileData);
  }

  async retrieveFile(id: string): Promise<File | null> {
    const fileData: any = await this.read('files', id);
    if (!fileData) return null;

    const blob = new Blob([fileData.data], { type: fileData.type });
    return new File([blob], fileData.name, {
      type: fileData.type,
      lastModified: fileData.lastModified
    });
  }

  async deleteFile(id: string): Promise<void> {
    await this.delete('files', id);
  }

  // Transaction support
  async transaction<T>(
    storeNames: string[],
    mode: IDBTransactionMode,
    operation: (stores: { [key: string]: IDBObjectStore }) => Promise<T>
  ): Promise<T> {
    await this.ensureConnection();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeNames, mode);
      const stores: { [key: string]: IDBObjectStore } = {};

      for (const storeName of storeNames) {
        stores[storeName] = transaction.objectStore(storeName);
      }

      transaction.oncomplete = () => {
        // Transaction completed successfully
      };

      transaction.onerror = () => reject(transaction.error);

      // Execute operation
      operation(stores)
        .then(resolve)
        .catch(reject);
    });
  }

  // Utility methods
  async clear(storeName: string): Promise<void> {
    await this.ensureConnection();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearAll(): Promise<void> {
    await this.ensureConnection();

    const promises = this.config.stores.map(store => this.clear(store.name));
    await Promise.all(promises);
  }

  async exportData(): Promise<any> {
    const data: any = {};

    for (const storeConfig of this.config.stores) {
      data[storeConfig.name] = await this.list(storeConfig.name);
    }

    return data;
  }

  async importData(data: any): Promise<void> {
    await this.clearAll();

    for (const [storeName, items] of Object.entries(data)) {
      if (Array.isArray(items)) {
        for (const item of items) {
          await this.create(storeName, item);
        }
      }
    }
  }

  async getStorageInfo(): Promise<{
    usage: number;
    quota: number;
    stores: { [key: string]: number };
  }> {
    const stores: { [key: string]: number } = {};

    for (const storeConfig of this.config.stores) {
      stores[storeConfig.name] = await this.count(storeConfig.name);
    }

    let usage = 0;
    let quota = 0;

    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      usage = estimate.usage || 0;
      quota = estimate.quota || 0;
    }

    return { usage, quota, stores };
  }

  private async ensureConnection(): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }
  }

  private fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }
}