import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface SnapshotHistory {
  id: number;
  operation: string;
  beforeState: any;
  afterState: any;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class SnapshotService {
  private maxHistorySize = 5;
  private history: SnapshotHistory[] = [];
  private redoStack: SnapshotHistory[] = [];

  // RxJS subjects for reactive updates
  private historySubject = new BehaviorSubject<SnapshotHistory[]>([]);
  private canUndoSubject = new BehaviorSubject<boolean>(false);
  private canRedoSubject = new BehaviorSubject<boolean>(false);

  constructor() { }

  /**
   * Get observable for history changes
   */
  get history$(): Observable<SnapshotHistory[]> {
    return this.historySubject.asObservable();
  }

  /**
   * Get observable for undo availability
   */
  get canUndo$(): Observable<boolean> {
    return this.canUndoSubject.asObservable();
  }

  /**
   * Get observable for redo availability
   */
  get canRedo$(): Observable<boolean> {
    return this.canRedoSubject.asObservable();
  }

  /**
   * Get current undo availability
   */
  get canUndo(): boolean {
    return this.history.length > 0;
  }

  /**
   * Get current redo availability
   */
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Get undo count
   */
  get undoCount(): number {
    return this.history.length;
  }

  /**
   * Capture an operation in history
   */
  captureOperation(operationName: string, beforeState: any, afterState: any): void {
    const snapshot: SnapshotHistory = {
      id: Date.now(),
      operation: operationName,
      beforeState: this.deepClone(beforeState),
      afterState: this.deepClone(afterState),
      timestamp: new Date()
    };

    // Add to history and keep only last 5
    this.history.push(snapshot);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    // Clear redo stack when new operation is performed
    this.redoStack = [];

    // Update observables
    this.historySubject.next([...this.history]);
    this.canUndoSubject.next(this.canUndo);
    this.canRedoSubject.next(this.canRedo);

    console.log(`📸 Operation captured: ${operationName} (History: ${this.history.length}/${this.maxHistorySize})`);
  }

  /**
   * Undo the last operation
   */
  undo(): any | null {
    if (this.history.length === 0) {
      console.warn('⚠️ No operations to undo');
      return null;
    }

    const lastOperation = this.history.pop();
    if (!lastOperation) return null;

    // Add to redo stack
    this.redoStack.push(lastOperation);

    // Update observables
    this.historySubject.next([...this.history]);
    this.canUndoSubject.next(this.canUndo);
    this.canRedoSubject.next(this.canRedo);

    console.log(`↶ Undo: ${lastOperation.operation}`);
    return this.deepClone(lastOperation.beforeState);
  }

  /**
   * Redo the last undone operation
   */
  redo(): any | null {
    if (this.redoStack.length === 0) {
      console.warn('⚠️ No operations to redo');
      return null;
    }

    const lastUndone = this.redoStack.pop();
    if (!lastUndone) return null;

    // Add back to history
    this.history.push(lastUndone);

    // Update observables
    this.historySubject.next([...this.history]);
    this.canUndoSubject.next(this.canUndo);
    this.canRedoSubject.next(this.canRedo);

    console.log(`↷ Redo: ${lastUndone.operation}`);
    return this.deepClone(lastUndone.afterState);
  }

  /**
   * Clear all history
   */
  clearHistory(): void {
    this.history = [];
    this.redoStack = [];
    this.historySubject.next([]);
    this.canUndoSubject.next(false);
    this.canRedoSubject.next(false);
    console.log('🗑️ History cleared');
  }

  /**
   * Get memory statistics (simplified for Angular)
   */
  getMemoryStats(): any {
    return {
      currentUsage: this.history.length * 1024, // Simplified calculation
      maxUsage: this.maxHistorySize * 1024,
      utilizationPercent: (this.history.length / this.maxHistorySize) * 100,
      undoStackSize: this.history.length,
      redoStackSize: 0
    };
  }

  /**
   * Get latest operation
   */
  getLatestOperation(): SnapshotHistory | null {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null;
  }

  /**
   * Get all history
   */
  getAllHistory(): SnapshotHistory[] {
    return [...this.history];
  }

  /**
   * Deep clone an object
   */
  private deepClone(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }

    if (obj instanceof Array) {
      return obj.map(item => this.deepClone(item));
    }

    if (obj instanceof File) {
      // For File objects, we'll store metadata only for the snapshot
      return {
        name: obj.name,
        size: obj.size,
        type: obj.type,
        lastModified: obj.lastModified,
        _isFileSnapshot: true
      };
    }

    if (typeof obj === 'object') {
      const cloned: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          cloned[key] = this.deepClone(obj[key]);
        }
      }
      return cloned;
    }

    return obj;
  }
}