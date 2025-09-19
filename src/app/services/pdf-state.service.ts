import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SnapshotService } from './snapshot.service';
import { PdfUtilsService } from './pdf-utils.service';

export interface PdfState {
  files: File[];
  selectedIndex: number | null;
  currentPage: number;
  numPages: number;
  selectedPages: number[];
  zoom: number;
  error: string | null;
  reorderedPages: any[] | null;
  isReordered: boolean;
  lastOperation: string | null;
  operationTimestamp: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class PdfStateService {
  private initialState: PdfState = {
    files: [],
    selectedIndex: null,
    currentPage: 1,
    numPages: 0,
    selectedPages: [],
    zoom: 1,
    error: null,
    reorderedPages: null,
    isReordered: false,
    lastOperation: null,
    operationTimestamp: null
  };

  private stateSubject = new BehaviorSubject<PdfState>(this.initialState);
  private loadingSubject = new BehaviorSubject<{ [key: string]: boolean }>({});

  constructor(
    private snapshotService: SnapshotService,
    private pdfUtilsService: PdfUtilsService
  ) {}

  /**
   * Get current state as observable
   */
  get state$(): Observable<PdfState> {
    return this.stateSubject.asObservable();
  }

  /**
   * Get current state value
   */
  get currentState(): PdfState {
    return this.stateSubject.value;
  }

  /**
   * Get loading state observable
   */
  get loading$(): Observable<{ [key: string]: boolean }> {
    return this.loadingSubject.asObservable();
  }

  /**
   * Update state with snapshot capture
   */
  private updateState(updates: Partial<PdfState>, operationName: string): void {
    const beforeState = this.currentState;
    const afterState: PdfState = {
      ...beforeState,
      ...updates,
      lastOperation: operationName,
      operationTimestamp: Date.now()
    };

    // Capture operation in snapshot service
    this.snapshotService.captureOperation(operationName, beforeState, afterState);

    // Update state
    this.stateSubject.next(afterState);
  }

  /**
   * Add files with unique IDs
   */
  addFiles(newFiles: File[]): void {
    const filesWithIds = newFiles.map((file, index) => {
      (file as any)._uniqueId = `${file.name}-${this.currentState.files.length + index}-${Date.now()}`;
      return file;
    });

    this.updateState({
      files: [...this.currentState.files, ...filesWithIds],
      selectedIndex: this.currentState.selectedIndex === null && newFiles.length > 0 ? 0 : this.currentState.selectedIndex
    }, 'Add Files');
  }

  /**
   * Remove file at index
   */
  removeFile(index: number): void {
    const newFiles = this.currentState.files.filter((_, i) => i !== index);
    let newSelectedIndex = this.currentState.selectedIndex;

    if (this.currentState.selectedIndex === index) {
      newSelectedIndex = newFiles.length > 0 ? 0 : null;
    } else if (this.currentState.selectedIndex !== null && this.currentState.selectedIndex > index) {
      newSelectedIndex = this.currentState.selectedIndex - 1;
    }

    this.updateState({
      files: newFiles,
      selectedIndex: newSelectedIndex,
      currentPage: 1,
      numPages: 0,
      selectedPages: []
    }, 'Remove File');
  }

  /**
   * Clear all files
   */
  clearFiles(): void {
    this.updateState({
      files: [],
      selectedIndex: null,
      currentPage: 1,
      numPages: 0,
      selectedPages: [],
      reorderedPages: null,
      isReordered: false
    }, 'Clear Files');
  }

  /**
   * Update file at index
   */
  updateFile(index: number, newFile: File, operationName: string = 'Update File'): void {
    const newFiles = [...this.currentState.files];

    // Preserve unique ID if it exists
    if ((this.currentState.files[index] as any)?._uniqueId) {
      (newFile as any)._uniqueId = (this.currentState.files[index] as any)._uniqueId;
    } else {
      (newFile as any)._uniqueId = `${newFile.name}-${index}-${Date.now()}`;
    }

    newFiles[index] = newFile;

    this.updateState({
      files: newFiles
    }, operationName);
  }

  /**
   * Set selected index
   */
  setSelectedIndex(index: number | null): void {
    this.updateState({ selectedIndex: index }, 'selection_change');
  }

  /**
   * Set current page
   */
  setCurrentPage(page: number): void {
    this.updateState({ currentPage: page }, 'page_navigation');
  }

  /**
   * Set number of pages
   */
  setNumPages(numPages: number): void {
    this.updateState({ numPages }, 'page_count_update');
  }

  /**
   * Set zoom level
   */
  setZoom(zoom: number): void {
    this.updateState({ zoom }, 'zoom_change');
  }

  /**
   * Set error
   */
  setError(error: string | null): void {
    this.updateState({ error }, 'error_update');
  }

  /**
   * Toggle page selection
   */
  togglePageSelection(pageNum: number): void {
    const currentPages = this.currentState.selectedPages;
    const newSelectedPages = currentPages.includes(pageNum)
      ? currentPages.filter(p => p !== pageNum)
      : [...currentPages, pageNum];

    this.updateState({ selectedPages: newSelectedPages }, 'selection_change');
  }

  /**
   * Clear page selection
   */
  clearPageSelection(): void {
    this.updateState({ selectedPages: [] }, 'selection_change');
  }

  /**
   * Save reordered pages
   */
  saveReorderedPages(orderedPagesData: any[]): void {
    this.updateState({
      reorderedPages: orderedPagesData,
      isReordered: true
    }, 'Reorder Pages');
  }

  /**
   * Clear reordered pages
   */
  clearReorderedPages(): void {
    this.updateState({
      reorderedPages: null,
      isReordered: false
    }, 'Clear Reorder');
  }

  /**
   * Get reordered pages by file index
   */
  getReorderedPagesByFile(fileIndex: number): any[] | null {
    if (!this.currentState.reorderedPages) return null;
    return this.currentState.reorderedPages.filter(page => page.fileIndex === fileIndex);
  }

  /**
   * Set loading state for an operation
   */
  setLoading(operation: string, loading: boolean): void {
    const currentLoading = this.loadingSubject.value;
    this.loadingSubject.next({
      ...currentLoading,
      [operation]: loading
    });
  }

  /**
   * Undo last operation
   */
  undo(): boolean {
    const previousState = this.snapshotService.undo();
    if (previousState) {
      this.stateSubject.next(previousState);
      return true;
    }
    return false;
  }

  /**
   * Redo last undone operation
   */
  redo(): boolean {
    const nextState = this.snapshotService.redo();
    if (nextState) {
      this.stateSubject.next(nextState);
      return true;
    }
    return false;
  }

  /**
   * Get snapshot service for external access
   */
  get snapshot(): SnapshotService {
    return this.snapshotService;
  }

  /**
   * Get PDF utils service for external access
   */
  get pdfUtils(): PdfUtilsService {
    return this.pdfUtilsService;
  }

  /**
   * Merge PDFs
   */
  async mergePdfs(files: File[]): Promise<Blob> {
    this.setLoading('merging', true);
    try {
      const result = await this.pdfUtilsService.mergePdfs(files);
      const blob = new Blob([result], { type: 'application/pdf' });

      // Update state with merged result
      const mergedFile = new File([blob], 'merged.pdf', { type: 'application/pdf' });
      this.updateState({
        files: [mergedFile],
        selectedIndex: 0,
        currentPage: 1,
        selectedPages: []
      }, 'Merge PDFs');

      return blob;
    } catch (error) {
      console.error('Error merging PDFs:', error);
      throw new Error('Failed to merge PDFs. Please try again.');
    } finally {
      this.setLoading('merging', false);
    }
  }

  /**
   * Compress PDF
   */
  async compressPdf(file: File, quality: any): Promise<Blob> {
    this.setLoading('compressing', true);
    try {
      const result = await this.pdfUtilsService.compressPdf(file, quality);
      const compressedFile = new File([result], `compressed_${file.name}`, { type: 'application/pdf' });

      // Update the specific file in the array
      const fileIndex = this.currentState.files.findIndex(f => f.name === file.name);
      if (fileIndex !== -1) {
        this.updateFile(fileIndex, compressedFile, 'Compress PDF');
      }

      return new Blob([result], { type: 'application/pdf' });
    } catch (error) {
      console.error('Error compressing PDF:', error);
      throw new Error('Failed to compress PDF. Please try again.');
    } finally {
      this.setLoading('compressing', false);
    }
  }

  /**
   * Add watermark to PDF
   */
  async addWatermark(file: File, text: string, options: any): Promise<Blob> {
    this.setLoading('watermarking', true);
    try {
      const result = await this.pdfUtilsService.addWatermark(file, text, options);

      // Update the specific file in the array
      const watermarkedFile = new File([result.data], `watermarked_${file.name}`, {
        type: 'application/pdf'
      });

      const fileIndex = this.currentState.files.findIndex(f => f.name === file.name);
      if (fileIndex !== -1) {
        this.updateFile(fileIndex, watermarkedFile, 'Add Watermark');
      }

      return result.blob;
    } catch (error) {
      console.error('Error adding watermark:', error);
      throw error;
    } finally {
      this.setLoading('watermarking', false);
    }
  }
}