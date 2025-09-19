import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  PdfDocument,
  PdfPage,
  OperationSnapshot,
  OperationType,
  createOperationSnapshot
} from '../models/pdf-document.model';

export interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
  currentIndex: number;
  totalSnapshots: number;
  currentOperation?: OperationSnapshot;
}

export interface HistoryConfig {
  maxSnapshots: number;
  autoSave: boolean;
  compressionEnabled: boolean;
  thumbnailSize: { width: number; height: number };
}

@Injectable({
  providedIn: 'root'
})
export class HistorySnapshotService {
  private readonly DEFAULT_CONFIG: HistoryConfig = {
    maxSnapshots: 50,
    autoSave: true,
    compressionEnabled: true,
    thumbnailSize: { width: 120, height: 150 }
  };

  private documentsHistory = new Map<string, OperationSnapshot[]>();
  private historyIndexes = new Map<string, number>();
  private historyStateSubject = new BehaviorSubject<{ [documentId: string]: HistoryState }>({});
  private config: HistoryConfig = { ...this.DEFAULT_CONFIG };

  constructor() {}

  get historyState$(): Observable<{ [documentId: string]: HistoryState }> {
    return this.historyStateSubject.asObservable();
  }

  /**
   * Initialize history for a document
   */
  initializeHistory(document: PdfDocument): void {
    if (!this.documentsHistory.has(document.id)) {
      // Create initial snapshot
      const initialSnapshot = createOperationSnapshot(
        'init',
        'Initial State',
        'Document loaded',
        document.pages.map(p => p.id)
      );

      initialSnapshot.documentState = document.currentVersion;
      initialSnapshot.thumbnails = this.generateSnapshotThumbnails(document.pages);

      this.documentsHistory.set(document.id, [initialSnapshot]);
      this.historyIndexes.set(document.id, 0);
      this.updateHistoryState(document.id);
    }
  }

  /**
   * Capture a new operation snapshot
   */
  async captureSnapshot(
    document: PdfDocument,
    operationType: OperationType,
    operationName: string,
    description: string,
    affectedPages: string[] = [],
    includeDocumentState: boolean = true
  ): Promise<OperationSnapshot> {
    const snapshot = createOperationSnapshot(
      operationType,
      operationName,
      description,
      affectedPages
    );

    // Add thumbnail previews for affected pages
    snapshot.thumbnails = this.generateSnapshotThumbnails(
      document.pages.filter(p => affectedPages.includes(p.id))
    );

    // Optionally include full document state
    if (includeDocumentState) {
      snapshot.documentState = new Uint8Array(document.currentVersion);
    }

    // Add metadata
    snapshot.metadata = {
      pageCount: document.totalPages,
      totalSize: document.currentVersion.length,
      operationDuration: 0 // Will be set by caller if needed
    };

    // Add snapshot to history
    this.addSnapshotToHistory(document.id, snapshot);

    return snapshot;
  }

  /**
   * Undo last operation
   */
  async undo(documentId: string): Promise<OperationSnapshot | null> {
    const history = this.documentsHistory.get(documentId);
    const currentIndex = this.historyIndexes.get(documentId);

    if (!history || currentIndex === undefined || currentIndex <= 0) {
      return null;
    }

    const newIndex = currentIndex - 1;
    this.historyIndexes.set(documentId, newIndex);
    this.updateHistoryState(documentId);

    return history[newIndex];
  }

  /**
   * Redo next operation
   */
  async redo(documentId: string): Promise<OperationSnapshot | null> {
    const history = this.documentsHistory.get(documentId);
    const currentIndex = this.historyIndexes.get(documentId);

    if (!history || currentIndex === undefined || currentIndex >= history.length - 1) {
      return null;
    }

    const newIndex = currentIndex + 1;
    this.historyIndexes.set(documentId, newIndex);
    this.updateHistoryState(documentId);

    return history[newIndex];
  }

  /**
   * Jump to specific snapshot in history
   */
  async jumpToSnapshot(documentId: string, snapshotIndex: number): Promise<OperationSnapshot | null> {
    const history = this.documentsHistory.get(documentId);

    if (!history || snapshotIndex < 0 || snapshotIndex >= history.length) {
      return null;
    }

    this.historyIndexes.set(documentId, snapshotIndex);
    this.updateHistoryState(documentId);

    return history[snapshotIndex];
  }

  /**
   * Get complete history for a document
   */
  getHistory(documentId: string): OperationSnapshot[] {
    return this.documentsHistory.get(documentId) || [];
  }

  /**
   * Get current snapshot
   */
  getCurrentSnapshot(documentId: string): OperationSnapshot | null {
    const history = this.documentsHistory.get(documentId);
    const currentIndex = this.historyIndexes.get(documentId);

    if (!history || currentIndex === undefined) {
      return null;
    }

    return history[currentIndex] || null;
  }

  /**
   * Get history state for a document
   */
  getHistoryState(documentId: string): HistoryState {
    const history = this.documentsHistory.get(documentId) || [];
    const currentIndex = this.historyIndexes.get(documentId) || 0;
    const currentSnapshot = history[currentIndex];

    return {
      canUndo: currentIndex > 0,
      canRedo: currentIndex < history.length - 1,
      currentIndex,
      totalSnapshots: history.length,
      currentOperation: currentSnapshot
    };
  }

  /**
   * Clear history for a document
   */
  clearHistory(documentId: string): void {
    this.documentsHistory.delete(documentId);
    this.historyIndexes.delete(documentId);
    this.updateHistoryState(documentId);
  }

  /**
   * Get history timeline for visual display
   */
  getHistoryTimeline(documentId: string): {
    snapshots: OperationSnapshot[];
    currentIndex: number;
    branchPoints: number[];
  } {
    const history = this.documentsHistory.get(documentId) || [];
    const currentIndex = this.historyIndexes.get(documentId) || 0;

    // Find branch points (where undo/redo created new branches)
    const branchPoints: number[] = [];
    // This would be more complex in a full implementation
    // For now, we'll keep it simple

    return {
      snapshots: history,
      currentIndex,
      branchPoints
    };
  }

  /**
   * Export history for backup/restore
   */
  exportHistory(documentId: string): {
    history: OperationSnapshot[];
    currentIndex: number;
    config: HistoryConfig;
  } | null {
    const history = this.documentsHistory.get(documentId);
    const currentIndex = this.historyIndexes.get(documentId);

    if (!history || currentIndex === undefined) {
      return null;
    }

    return {
      history: history.map(snapshot => ({
        ...snapshot,
        // Remove heavy document state for export
        documentState: undefined
      })),
      currentIndex,
      config: this.config
    };
  }

  /**
   * Import history from backup
   */
  importHistory(
    documentId: string,
    historyData: {
      history: OperationSnapshot[];
      currentIndex: number;
      config?: HistoryConfig;
    }
  ): void {
    this.documentsHistory.set(documentId, historyData.history);
    this.historyIndexes.set(documentId, historyData.currentIndex);

    if (historyData.config) {
      this.config = { ...this.config, ...historyData.config };
    }

    this.updateHistoryState(documentId);
  }

  /**
   * Get memory usage statistics
   */
  getMemoryUsage(): {
    totalDocuments: number;
    totalSnapshots: number;
    estimatedMemoryMB: number;
    documentsBreakdown: { [documentId: string]: { snapshots: number; sizeMB: number } };
  } {
    let totalSnapshots = 0;
    let estimatedBytes = 0;
    const documentsBreakdown: { [documentId: string]: { snapshots: number; sizeMB: number } } = {};

    for (const [documentId, history] of this.documentsHistory.entries()) {
      totalSnapshots += history.length;
      let documentBytes = 0;

      for (const snapshot of history) {
        // Estimate memory usage
        documentBytes += snapshot.documentState?.length || 0;
        documentBytes += JSON.stringify(snapshot.thumbnails).length * 2; // Rough estimate
        documentBytes += 1000; // Metadata overhead
      }

      documentsBreakdown[documentId] = {
        snapshots: history.length,
        sizeMB: Math.round((documentBytes / 1024 / 1024) * 100) / 100
      };

      estimatedBytes += documentBytes;
    }

    return {
      totalDocuments: this.documentsHistory.size,
      totalSnapshots,
      estimatedMemoryMB: Math.round((estimatedBytes / 1024 / 1024) * 100) / 100,
      documentsBreakdown
    };
  }

  /**
   * Optimize memory usage
   */
  optimizeMemory(): {
    removedSnapshots: number;
    freedMemoryMB: number;
  } {
    let removedSnapshots = 0;
    let freedBytes = 0;

    for (const [documentId, history] of this.documentsHistory.entries()) {
      if (history.length > this.config.maxSnapshots) {
        const excessSnapshots = history.length - this.config.maxSnapshots;
        const currentIndex = this.historyIndexes.get(documentId) || 0;

        // Keep snapshots around current index
        const keepStart = Math.max(0, currentIndex - Math.floor(this.config.maxSnapshots / 2));
        const keepEnd = keepStart + this.config.maxSnapshots;

        const removedHistory = history.splice(0, keepStart).concat(
          history.splice(keepEnd - keepStart)
        );

        // Update current index
        this.historyIndexes.set(documentId, currentIndex - keepStart);

        // Calculate freed memory
        for (const snapshot of removedHistory) {
          freedBytes += snapshot.documentState?.length || 0;
          freedBytes += JSON.stringify(snapshot.thumbnails).length * 2;
        }

        removedSnapshots += removedHistory.length;
      }

      // Also remove document states from older snapshots if compression is enabled
      if (this.config.compressionEnabled) {
        const currentIndex = this.historyIndexes.get(documentId) || 0;
        const compressionThreshold = 10; // Keep full state for last 10 operations

        for (let i = 0; i < history.length - compressionThreshold; i++) {
          if (i !== currentIndex && history[i].documentState) {
            freedBytes += history[i].documentState!.length;
            history[i].documentState = undefined;
          }
        }
      }
    }

    return {
      removedSnapshots,
      freedMemoryMB: Math.round((freedBytes / 1024 / 1024) * 100) / 100
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<HistoryConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Private helper methods
  private addSnapshotToHistory(documentId: string, snapshot: OperationSnapshot): void {
    let history = this.documentsHistory.get(documentId) || [];
    const currentIndex = this.historyIndexes.get(documentId) || 0;

    // If we're not at the end of history, truncate future snapshots
    if (currentIndex < history.length - 1) {
      history = history.slice(0, currentIndex + 1);
    }

    // Add new snapshot
    history.push(snapshot);

    // Enforce max snapshots limit
    if (history.length > this.config.maxSnapshots) {
      history.shift(); // Remove oldest
    } else {
      // Update index to point to new snapshot
      this.historyIndexes.set(documentId, history.length - 1);
    }

    this.documentsHistory.set(documentId, history);
    this.updateHistoryState(documentId);
  }

  private generateSnapshotThumbnails(pages: PdfPage[]): { [pageId: string]: string } {
    const thumbnails: { [pageId: string]: string } = {};

    for (const page of pages) {
      if (page.thumbnail) {
        // Create smaller thumbnail for history
        thumbnails[page.id] = this.resizeThumbnail(
          page.thumbnail,
          this.config.thumbnailSize.width,
          this.config.thumbnailSize.height
        );
      }
    }

    return thumbnails;
  }

  private resizeThumbnail(originalThumbnail: string, maxWidth: number, maxHeight: number): string {
    // Create canvas to resize image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();

    return new Promise<string>((resolve) => {
      img.onload = () => {
        const aspectRatio = img.width / img.height;
        let { width, height } = { width: maxWidth, height: maxHeight };

        if (aspectRatio > 1) {
          height = width / aspectRatio;
        } else {
          width = height * aspectRatio;
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = originalThumbnail;
    }) as any; // Type assertion for simplicity

    // For immediate return, return original (in real implementation, use async)
    return originalThumbnail;
  }

  private updateHistoryState(documentId: string): void {
    const currentStates = this.historyStateSubject.value;
    const newState = this.getHistoryState(documentId);

    this.historyStateSubject.next({
      ...currentStates,
      [documentId]: newState
    });
  }
}