import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { filter, map, take } from 'rxjs/operators';

export interface WorkerTask {
  id: string;
  type: string;
  data: any;
  priority: 'low' | 'medium' | 'high';
  timeout?: number;
}

export interface WorkerResult<T = any> {
  id: string;
  type: string;
  success: boolean;
  data?: T;
  error?: string;
}

export interface WorkerProgress {
  id: string;
  progress: number;
}

export interface WorkerPoolStats {
  activeWorkers: number;
  queueLength: number;
  completedTasks: number;
  failedTasks: number;
  averageTaskTime: number;
}

@Injectable({
  providedIn: 'root'
})
export class WebWorkerService {
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private taskQueue: WorkerTask[] = [];
  private pendingTasks = new Map<string, {
    task: WorkerTask;
    resolve: (result: WorkerResult) => void;
    reject: (error: any) => void;
    startTime: number;
    timeout?: any;
  }>();

  private maxWorkers = Math.max(2, Math.min(navigator.hardwareConcurrency || 4, 8));
  private workerUrl: string;

  // Observables
  private progressSubject = new Subject<WorkerProgress>();
  private statsSubject = new BehaviorSubject<WorkerPoolStats>({
    activeWorkers: 0,
    queueLength: 0,
    completedTasks: 0,
    failedTasks: 0,
    averageTaskTime: 0
  });

  // Statistics
  private completedTasks = 0;
  private failedTasks = 0;
  private totalTaskTime = 0;

  constructor() {
    // Disable Web Workers due to ArrayBuffer detachment issues
    // this.workerUrl = this.createWorkerUrl();
    // this.initializeWorkerPool();
    this.workerUrl = '';
  }

  get progress$(): Observable<WorkerProgress> {
    return this.progressSubject.asObservable();
  }

  get stats$(): Observable<WorkerPoolStats> {
    return this.statsSubject.asObservable();
  }

  /**
   * Execute a task using the worker pool
   */
  async executeTask<T = any>(
    type: string,
    data: any,
    priority: 'low' | 'medium' | 'high' = 'medium',
    timeout: number = 300000 // 5 minutes default
  ): Promise<T> {
    // Web Workers disabled due to ArrayBuffer detachment issues
    throw new Error(`Web Worker task '${type}' is disabled due to ArrayBuffer detachment issues`);

    const task: WorkerTask = {
      id: this.generateTaskId(),
      type,
      data,
      priority,
      timeout
    };

    return new Promise<T>((resolve, reject) => {
      const pendingTask = {
        task,
        resolve: (result: WorkerResult) => {
          if (result.success) {
            resolve(result.data);
          } else {
            reject(new Error(result.error || 'Task failed'));
          }
        },
        reject,
        startTime: Date.now(),
        timeout: undefined as any
      };

      // Set timeout if specified
      if (timeout > 0) {
        pendingTask.timeout = setTimeout(() => {
          this.handleTaskTimeout(task.id);
        }, timeout);
      }

      this.pendingTasks.set(task.id, pendingTask);
      this.addTaskToQueue(task);
    });
  }

  /**
   * Get progress updates for a specific task
   */
  getTaskProgress(taskId: string): Observable<number> {
    return this.progress$.pipe(
      filter(progress => progress.id === taskId),
      map(progress => progress.progress)
    );
  }

  /**
   * Cancel a pending task
   */
  cancelTask(taskId: string): boolean {
    const pendingTask = this.pendingTasks.get(taskId);
    if (pendingTask) {
      if (pendingTask.timeout) {
        clearTimeout(pendingTask.timeout);
      }
      this.pendingTasks.delete(taskId);

      // Remove from queue if not yet started
      const queueIndex = this.taskQueue.findIndex(task => task.id === taskId);
      if (queueIndex !== -1) {
        this.taskQueue.splice(queueIndex, 1);
        this.updateStats();
        return true;
      }
    }
    return false;
  }

  /**
   * Get current worker pool statistics
   */
  getStats(): WorkerPoolStats {
    return this.statsSubject.value;
  }

  /**
   * Resize the worker pool
   */
  resizeWorkerPool(newSize: number): void {
    const targetSize = Math.max(1, Math.min(newSize, 16)); // Limit between 1-16 workers

    if (targetSize > this.workers.length) {
      // Add more workers
      for (let i = this.workers.length; i < targetSize; i++) {
        this.createWorker();
      }
    } else if (targetSize < this.workers.length) {
      // Remove excess workers
      const excessWorkers = this.workers.splice(targetSize);
      excessWorkers.forEach(worker => {
        // Only terminate idle workers
        const workerIndex = this.availableWorkers.indexOf(worker);
        if (workerIndex !== -1) {
          this.availableWorkers.splice(workerIndex, 1);
          worker.terminate();
        }
      });
    }

    this.maxWorkers = targetSize;
    this.updateStats();
  }

  /**
   * Clear all pending tasks and reset the queue
   */
  clearQueue(): void {
    // Cancel all pending tasks
    Array.from(this.pendingTasks.keys()).forEach(taskId => {
      this.cancelTask(taskId);
    });

    this.taskQueue = [];
    this.updateStats();
  }

  /**
   * Terminate all workers and cleanup
   */
  destroy(): void {
    this.clearQueue();

    this.workers.forEach(worker => worker.terminate());
    this.workers = [];
    this.availableWorkers = [];

    if (this.workerUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.workerUrl);
    }
  }

  // Private methods

  private initializeWorkerPool(): void {
    for (let i = 0; i < this.maxWorkers; i++) {
      this.createWorker();
    }
  }

  private createWorker(): Worker {
    const worker = new Worker(this.workerUrl, { type: 'module' });

    worker.onmessage = (event) => {
      this.handleWorkerMessage(worker, event.data);
    };

    worker.onerror = (error) => {
      this.handleWorkerError(worker, error);
    };

    this.workers.push(worker);
    this.availableWorkers.push(worker);

    return worker;
  }

  private createWorkerUrl(): string {
    // For development, we'll create an inline worker
    // In production, you would load from a separate file
    const workerScript = `
      // Inline worker for development
      console.log('Web Worker initialized');

      self.addEventListener('message', function(e) {
        const { id, type, data } = e.data;

        // Simple echo for testing
        self.postMessage({
          id: id,
          type: type,
          success: true,
          data: 'Worker response: ' + type
        });
      });
    `;

    const blob = new Blob([workerScript], { type: 'application/javascript' });
    return URL.createObjectURL(blob);
  }

  private addTaskToQueue(task: WorkerTask): void {
    // Insert task based on priority
    const insertIndex = this.taskQueue.findIndex(queuedTask => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[queuedTask.priority] < priorityOrder[task.priority];
    });

    if (insertIndex === -1) {
      this.taskQueue.push(task);
    } else {
      this.taskQueue.splice(insertIndex, 0, task);
    }

    this.updateStats();
    this.processQueue();
  }

  private processQueue(): void {
    while (this.taskQueue.length > 0 && this.availableWorkers.length > 0) {
      const task = this.taskQueue.shift()!;
      const worker = this.availableWorkers.shift()!;

      this.executeTaskOnWorker(worker, task);
    }

    this.updateStats();
  }

  private executeTaskOnWorker(worker: Worker, task: WorkerTask): void {
    const message = {
      id: task.id,
      type: task.type,
      data: task.data
    };

    worker.postMessage(message);
  }

  private handleWorkerMessage(worker: Worker, response: any): void {
    const { id, type, success, data, error, progress } = response;

    if (type === 'progress') {
      this.progressSubject.next({ id, progress });
      return;
    }

    const pendingTask = this.pendingTasks.get(id);
    if (!pendingTask) {
      return; // Task was cancelled or doesn't exist
    }

    // Clear timeout
    if (pendingTask.timeout) {
      clearTimeout(pendingTask.timeout);
    }

    // Calculate task duration
    const taskDuration = Date.now() - pendingTask.startTime;
    this.totalTaskTime += taskDuration;

    // Update statistics
    if (success) {
      this.completedTasks++;
    } else {
      this.failedTasks++;
    }

    // Remove from pending tasks
    this.pendingTasks.delete(id);

    // Return worker to available pool
    this.availableWorkers.push(worker);

    // Resolve or reject the promise
    const result: WorkerResult = { id, type, success, data, error };
    pendingTask.resolve(result);

    // Process next task in queue
    this.processQueue();
    this.updateStats();
  }

  private handleWorkerError(worker: Worker, error: ErrorEvent): void {
    console.error('Worker error:', error);

    // Find and reject all tasks assigned to this worker
    for (const [taskId, pendingTask] of this.pendingTasks.entries()) {
      if (this.isTaskAssignedToWorker(taskId, worker)) {
        if (pendingTask.timeout) {
          clearTimeout(pendingTask.timeout);
        }

        this.pendingTasks.delete(taskId);
        this.failedTasks++;

        pendingTask.reject(new Error(`Worker error: ${error.message}`));
      }
    }

    // Replace the failed worker
    const workerIndex = this.workers.indexOf(worker);
    if (workerIndex !== -1) {
      this.workers[workerIndex] = this.createWorker();
    }

    // Remove from available workers if present
    const availableIndex = this.availableWorkers.indexOf(worker);
    if (availableIndex !== -1) {
      this.availableWorkers.splice(availableIndex, 1);
    }

    worker.terminate();
    this.updateStats();
  }

  private handleTaskTimeout(taskId: string): void {
    const pendingTask = this.pendingTasks.get(taskId);
    if (pendingTask) {
      this.pendingTasks.delete(taskId);
      this.failedTasks++;

      pendingTask.reject(new Error('Task timeout'));
      this.updateStats();
    }
  }

  private isTaskAssignedToWorker(taskId: string, worker: Worker): boolean {
    // Simple check - in a more complex implementation, you'd track worker assignments
    return !this.availableWorkers.includes(worker);
  }

  private updateStats(): void {
    const stats: WorkerPoolStats = {
      activeWorkers: this.workers.length - this.availableWorkers.length,
      queueLength: this.taskQueue.length,
      completedTasks: this.completedTasks,
      failedTasks: this.failedTasks,
      averageTaskTime: this.completedTasks > 0 ? this.totalTaskTime / this.completedTasks : 0
    };

    this.statsSubject.next(stats);
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}