import { Component, OnInit, OnDestroy, Input, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { PdfDocument, PdfPage, OperationType, ExportConfig } from '../models/pdf-document.model';
import { PdfEngineService } from '../services/pdf-engine.service';
import { HistorySnapshotService } from '../services/history-snapshot.service';
import { LazyLoadingService } from '../services/lazy-loading.service';
import { WebWorkerService } from '../services/web-worker.service';
import { PdfPreviewGridComponent, PageSelectionEvent, PageOperation } from './pdf-preview-grid.component';
import { PageEditorComponent } from './page-editor.component';
import { PdfPreviewModalComponent } from './pdf-preview-modal.component';

@Component({
  selector: 'app-pdf-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule, PdfPreviewGridComponent, PageEditorComponent, PdfPreviewModalComponent],
  template: `
    <div class="pdf-viewer h-screen flex flex-col bg-gray-50">
      <!-- Main Toolbar -->
      <div class="toolbar bg-white border-b border-gray-200 p-4">
        <div class="flex items-center justify-between">
          <!-- Document Info -->
          <div class="flex items-center space-x-4">
            <div class="flex items-center space-x-2">
              <div class="w-8 h-8 bg-red-100 rounded flex items-center justify-center">
                <span class="text-lg">📄</span>
              </div>
              <div>
                <h1 class="text-lg font-semibold text-gray-900">{{document?.name || 'PDF Document'}}</h1>
                <p class="text-sm text-gray-500" *ngIf="document">
                  {{document.totalPages}} pages • {{formatFileSize(document.fileSize)}}
                </p>
              </div>
            </div>

            <!-- Selection Info -->
            <div *ngIf="selectedPagesCount > 0" class="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
              {{selectedPagesCount}} page{{selectedPagesCount > 1 ? 's' : ''}} selected
            </div>

            <!-- Performance Stats (for large documents) -->
            <div *ngIf="document && document.totalPages > 50" class="text-xs text-gray-500 space-x-2">
              <span>Memory: {{formatMemoryUsage(memoryUsage)}}</span>
              <span *ngIf="workerStats.activeWorkers > 0">
                • Workers: {{workerStats.activeWorkers}}/{{workerStats.activeWorkers + workerStats.queueLength}}
              </span>
            </div>
          </div>

          <!-- Primary Actions -->
          <div class="flex items-center space-x-3">
            <!-- File Operations -->
            <div class="flex items-center space-x-2">
              <input
                type="file"
                accept=".pdf"
                multiple
                (change)="onFileSelect($event)"
                class="hidden"
                #fileInput
              >
              <button
                (click)="fileInput.click()"
                class="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                📁 Open PDF
              </button>
              <button
                *ngIf="document"
                (click)="showFullscreenPreview()"
                class="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors"
                title="Full-screen PDF Preview"
              >
                👁️ Preview
              </button>
            </div>

            <!-- Document Operations -->
            <div class="flex items-center space-x-1 border-l border-gray-300 pl-3" *ngIf="document">
              <button
                (click)="compressPdf()"
                [disabled]="isProcessing"
                class="px-3 py-2 text-sm bg-orange-100 text-orange-700 border border-orange-300 rounded hover:bg-orange-200 disabled:opacity-50 transition-colors"
                title="Compress PDF"
              >
                🗜️ Compress
              </button>

              <button
                (click)="showSplitDialog = true"
                class="px-3 py-2 text-sm bg-yellow-100 text-yellow-700 border border-yellow-300 rounded hover:bg-yellow-200 transition-colors"
                title="Split PDF"
              >
                ✂️ Split
              </button>

              <button
                (click)="showWatermarkDialog = true"
                class="px-3 py-2 text-sm bg-cyan-100 text-cyan-700 border border-cyan-300 rounded hover:bg-cyan-200 transition-colors"
                title="Add watermark"
              >
                💧 Watermark
              </button>
            </div>

            <!-- Export -->
            <div class="flex items-center space-x-1 border-l border-gray-300 pl-3" *ngIf="document">
              <div class="relative">
                <button
                  (click)="showExportMenu = !showExportMenu"
                  class="px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-1"
                >
                  <span>⬇️ Export</span>
                  <span class="text-xs">▼</span>
                </button>

                <!-- Export Dropdown -->
                <div
                  *ngIf="showExportMenu"
                  class="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
                >
                  <button
                    (click)="exportAsPdf(); showExportMenu = false"
                    class="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <span>📄</span>
                    <span>Export as PDF</span>
                  </button>
                  <button
                    (click)="exportAsImages('png'); showExportMenu = false"
                    class="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <span>🖼️</span>
                    <span>Export as PNG Images</span>
                  </button>
                  <button
                    (click)="exportAsImages('jpg'); showExportMenu = false"
                    class="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <span>📸</span>
                    <span>Export as JPG Images</span>
                  </button>
                  <button
                    (click)="exportAsImages('zip'); showExportMenu = false"
                    class="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <span>🗜️</span>
                    <span>Export as ZIP</span>
                  </button>
                </div>
              </div>

              <!-- History Controls -->
              <div class="flex items-center space-x-1 border-l border-gray-300 pl-3">
                <button
                  (click)="undo()"
                  [disabled]="!canUndo || isProcessing"
                  class="px-3 py-2 text-sm bg-gray-100 text-gray-700 border border-gray-300 rounded hover:bg-gray-200 disabled:opacity-50 transition-colors"
                  title="Undo (Ctrl+Z)"
                >
                  ↶ Undo
                </button>
                <button
                  (click)="redo()"
                  [disabled]="!canRedo || isProcessing"
                  class="px-3 py-2 text-sm bg-gray-100 text-gray-700 border border-gray-300 rounded hover:bg-gray-200 disabled:opacity-50 transition-colors"
                  title="Redo (Ctrl+Y)"
                >
                  ↷ Redo
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- PDF Preview Grid -->
      <div class="flex-1 overflow-hidden" *ngIf="document && !editingPage">
        <app-pdf-preview-grid
          [document]="document"
          [showHistoryTimeline]="false"
          [enableDragDrop]="true"
          [selectionMode]="'multiple'"
          (pageSelectionChange)="onPageSelectionChange($event)"
          (pageOperation)="onPageOperation($event)"
          (pageEdit)="onPageEdit($event)"
          (pageReorder)="onPageReorder($event)"
        ></app-pdf-preview-grid>
      </div>

      <!-- Page Editor -->
      <div class="flex-1 overflow-hidden" *ngIf="editingPage && document">
        <app-page-editor
          [page]="editingPage"
          [document]="document"
          (pageUpdated)="onPageUpdated($event)"
          (editorClosed)="onEditorClosed()"
        ></app-page-editor>
      </div>

      <!-- Empty State -->
      <div *ngIf="!document" class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <div class="text-6xl mb-4">📄</div>
          <h2 class="text-2xl font-bold text-gray-900 mb-4">PDF Master Tool</h2>
          <p class="text-gray-600 mb-8 max-w-md">
            Upload PDF files to view, edit, merge, split, and perform various operations.
            All processing happens in your browser - no data is sent to servers.
          </p>

          <div class="space-y-4">
            <button
              (click)="fileInput.click()"
              class="px-8 py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg"
            >
              📁 Choose PDF Files
            </button>

            <div class="text-sm text-gray-500">
              Or drag and drop PDF files anywhere on this page
            </div>
          </div>

          <!-- Features List -->
          <div class="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto text-sm">
            <div class="text-center">
              <div class="text-2xl mb-2">📎</div>
              <div class="font-medium text-gray-900">Merge PDFs</div>
              <div class="text-gray-500">Combine multiple PDFs</div>
            </div>
            <div class="text-center">
              <div class="text-2xl mb-2">✂️</div>
              <div class="font-medium text-gray-900">Split & Extract</div>
              <div class="text-gray-500">Split pages or extract selections</div>
            </div>
            <div class="text-center">
              <div class="text-2xl mb-2">🔄</div>
              <div class="font-medium text-gray-900">Rotate & Reorder</div>
              <div class="text-gray-500">Drag to reorder pages</div>
            </div>
            <div class="text-center">
              <div class="text-2xl mb-2">🗜️</div>
              <div class="font-medium text-gray-900">Compress</div>
              <div class="text-gray-500">Reduce file size</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Watermark Dialog -->
      <div
        *ngIf="showWatermarkDialog"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        (click)="closeWatermarkDialog()"
      >
        <div
          class="bg-white rounded-lg p-6 max-w-md w-full mx-4"
          (click)="$event.stopPropagation()"
        >
          <h3 class="text-lg font-semibold mb-4">Add Watermark</h3>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Watermark Text</label>
              <input
                type="text"
                [(ngModel)]="watermarkConfig.text"
                placeholder="Enter watermark text"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Position</label>
              <select
                [(ngModel)]="watermarkConfig.position"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="center">Center</option>
                <option value="top-left">Top Left</option>
                <option value="top-right">Top Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="bottom-right">Bottom Right</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Opacity</label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                [(ngModel)]="watermarkConfig.opacity"
                class="w-full"
              >
              <div class="text-sm text-gray-500 text-center">{{(watermarkConfig.opacity * 100).toFixed(0)}}%</div>
            </div>
          </div>

          <div class="flex justify-end space-x-3 mt-6">
            <button
              (click)="closeWatermarkDialog()"
              class="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              (click)="applyWatermark()"
              [disabled]="!watermarkConfig.text || isProcessing"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Apply Watermark
            </button>
          </div>
        </div>
      </div>

      <!-- Split Dialog -->
      <div
        *ngIf="showSplitDialog"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        (click)="closeSplitDialog()"
      >
        <div
          class="bg-white rounded-lg p-6 max-w-lg w-full mx-4"
          (click)="$event.stopPropagation()"
        >
          <h3 class="text-lg font-semibold mb-4">Split PDF</h3>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Split Method</label>
              <select
                [(ngModel)]="splitConfig.method"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="pages">Split at specific pages</option>
                <option value="range">Split by page ranges</option>
              </select>
            </div>

            <div *ngIf="splitConfig.method === 'pages'">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Split at pages (comma separated)
              </label>
              <input
                type="text"
                [(ngModel)]="splitPagesInput"
                placeholder="e.g., 3,6,10"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
              <div class="text-xs text-gray-500 mt-1">
                Enter page numbers where you want to split the PDF
              </div>
            </div>

            <div *ngIf="splitConfig.method === 'range'">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Page Ranges (one per line)
              </label>
              <textarea
                [(ngModel)]="splitRangesInput"
                placeholder="1-5&#10;6-10&#10;11-15"
                rows="4"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              ></textarea>
              <div class="text-xs text-gray-500 mt-1">
                Enter ranges like "1-5" or "3-8", one per line
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Output Prefix</label>
              <input
                type="text"
                [(ngModel)]="splitConfig.outputPrefix"
                placeholder="document_part"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
            </div>
          </div>

          <div class="flex justify-end space-x-3 mt-6">
            <button
              (click)="closeSplitDialog()"
              class="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              (click)="applySplit()"
              [disabled]="!isValidSplitConfig() || isProcessing"
              class="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 transition-colors"
            >
              Split PDF
            </button>
          </div>
        </div>
      </div>

      <!-- Loading Overlay -->
      <div *ngIf="isProcessing" class="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-40">
        <div class="bg-white rounded-lg p-6 text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p class="text-gray-700 font-medium">{{processingMessage}}</p>
          <div *ngIf="processingProgress > 0" class="w-64 bg-gray-200 rounded-full h-2 mx-auto mt-3">
            <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" [style.width.%]="processingProgress"></div>
          </div>
        </div>
      </div>

      <!-- PDF Preview Modal -->
      <app-pdf-preview-modal
        [isVisible]="showPreviewModal"
        [file]="previewFile"
        (closed)="closePreview()"
        (error)="onPreviewError($event)"
      ></app-pdf-preview-modal>

      <!-- Hidden file input -->
      <input
        #fileInput
        type="file"
        accept=".pdf"
        multiple
        (change)="onFileSelect($event)"
        class="hidden"
      >
    </div>
  `,
  styles: [`
    .pdf-viewer {
      position: relative;
    }

    .toolbar {
      flex-shrink: 0;
    }
  `]
})
export class PdfViewerComponent implements OnInit, OnDestroy {
  @Input() initialFiles?: File[];

  document: PdfDocument | null = null;
  selectedPagesCount = 0;
  isProcessing = false;
  processingMessage = '';
  processingProgress = 0;

  // Page editing state
  editingPage: PdfPage | null = null;

  // Performance monitoring
  memoryUsage = 0;
  workerStats = {
    activeWorkers: 0,
    queueLength: 0,
    completedTasks: 0,
    failedTasks: 0,
    averageTaskTime: 0
  };

  // UI state
  showWatermarkDialog = false;
  showSplitDialog = false;
  showExportMenu = false;
  showPreviewModal = false;
  previewFile: File | null = null;

  // History state
  canUndo = false;
  canRedo = false;

  // Watermark configuration
  watermarkConfig = {
    text: '',
    position: 'center',
    opacity: 0.3,
    fontSize: 36
  };

  // Split configuration
  splitConfig = {
    method: 'pages' as 'pages' | 'range',
    outputPrefix: 'document_part'
  };
  splitPagesInput = '';
  splitRangesInput = '';

  @ViewChild('fileInput') fileInput: any;

  private destroy$ = new Subject<void>();

  constructor(
    private pdfEngine: PdfEngineService,
    private historyService: HistorySnapshotService,
    private lazyLoading: LazyLoadingService,
    private webWorkerService: WebWorkerService
  ) {}

  ngOnInit(): void {
    // Subscribe to processing state
    this.pdfEngine.processing$
      .pipe(takeUntil(this.destroy$))
      .subscribe(processing => {
        this.isProcessing = Object.values(processing).some(p => p);
        this.updateProcessingMessage(processing);
      });

    // Subscribe to progress
    this.pdfEngine.progress$
      .pipe(takeUntil(this.destroy$))
      .subscribe(progress => {
        const activeProgress = Object.values(progress).find(p => p > 0);
        this.processingProgress = activeProgress || 0;
      });

    // Subscribe to memory usage
    this.lazyLoading.memoryUsage$
      .pipe(takeUntil(this.destroy$))
      .subscribe(usage => {
        this.memoryUsage = usage;
      });

    // Subscribe to worker pool stats
    this.webWorkerService.stats$
      .pipe(takeUntil(this.destroy$))
      .subscribe(stats => {
        this.workerStats = stats;
      });

    // Load initial files if provided
    if (this.initialFiles && this.initialFiles.length > 0) {
      this.loadPdfFile(this.initialFiles[0]);
    }

    // Set up global drag and drop
    this.setupGlobalDragDrop();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // File handling
  async onFileSelect(event: any): Promise<void> {
    const files = Array.from(event.target.files) as File[];
    if (files.length > 0) {
      await this.loadPdfFile(files[0]);
    }
    // Clear input
    event.target.value = '';
  }

  private async loadPdfFile(file: File): Promise<void> {
    try {
      this.processingMessage = 'Loading PDF...';
      this.document = await this.pdfEngine.loadPdfDocument(file);
      this.updateHistoryState();
    } catch (error) {
      console.error('Failed to load PDF:', error);
      alert('Failed to load PDF file. Please ensure it\'s a valid PDF.');
    }
  }

  // Page operations event handlers
  onPageSelectionChange(event: PageSelectionEvent): void {
    this.selectedPagesCount = event.selectionCount;
  }

  onPageOperation(event: PageOperation): void {
    console.log('Page operation:', event);
    this.updateHistoryState();
  }

  onPageEdit(page: PdfPage): void {
    this.editingPage = page;
  }

  async onPageUpdated(updatedPage: PdfPage): Promise<void> {
    if (!this.document) return;

    // Find and update the page in the document
    const pageIndex = this.document.pages.findIndex(p => p.id === updatedPage.id);
    if (pageIndex !== -1) {
      this.document.pages[pageIndex] = updatedPage;
      this.document.updatedAt = new Date();

      // Reset to original PDF and reapply ALL annotations from ALL pages
      // This prevents layering issues where annotations get applied multiple times
      await this.reapplyAllAnnotations();

      // Regenerate thumbnails for pages with annotations
      const pagesWithAnnotations = this.document.pages.filter(page =>
        page.annotations && page.annotations.length > 0
      );

      for (const page of pagesWithAnnotations) {
        try {
          const newThumbnail = await this.pdfEngine.regenerateThumbnail(
            this.document,
            page.pageNumber,
            { width: 200, quality: 0.8 }
          );

          if (newThumbnail) {
            const idx = this.document.pages.findIndex(p => p.id === page.id);
            if (idx !== -1) {
              this.document.pages[idx].thumbnail = newThumbnail;
            }
          }
        } catch (error) {
          console.error(`Failed to regenerate thumbnail for page ${page.pageNumber}:`, error);
        }
      }

      // Capture history snapshot for page editing
      await this.historyService.captureSnapshot(
        this.document,
        'annotate',
        'Edit Page',
        `Page ${updatedPage.pageNumber} edited with ${updatedPage.annotations.length} annotation(s)`,
        [updatedPage.id]
      );

      this.updateHistoryState();
    }
  }

  /**
   * Reset to original PDF and reapply all annotations from all pages
   */
  private async reapplyAllAnnotations(): Promise<void> {
    if (!this.document) return;

    try {
      // Start with the original clean PDF (without any annotations)
      let currentPdf = this.document.originalFile ?
        new Uint8Array(await this.document.originalFile.arrayBuffer()) :
        this.document.currentVersion;

      // Get all pages that have annotations
      const pagesWithAnnotations = this.document.pages.filter(page =>
        page.annotations && page.annotations.length > 0
      );

      if (pagesWithAnnotations.length === 0) {
        this.document.currentVersion = currentPdf;
        return;
      }

      console.log(`Reapplying annotations from ${pagesWithAnnotations.length} pages to clean PDF...`);

      // Apply annotations from each page to the clean PDF
      for (const page of pagesWithAnnotations) {
        const tempDocument = { ...this.document, currentVersion: currentPdf };

        const result = await this.pdfEngine.applyAnnotations(tempDocument, page.id);
        if (result.success && result.data) {
          currentPdf = result.data;
          console.log(`Applied ${page.annotations.length} annotations from page ${page.pageNumber}`);
        } else {
          console.error(`Failed to apply annotations from page ${page.pageNumber}:`, result.error);
        }
      }

      // Update the document with the final PDF
      this.document.currentVersion = currentPdf;
      console.log('Successfully reapplied all annotations to clean PDF');

    } catch (error) {
      console.error('Failed to reapply all annotations:', error);
    }
  }

  onEditorClosed(): void {
    this.editingPage = null;
  }

  onPageReorder(event: { fromIndex: number; toIndex: number }): void {
    console.log('Page reordered:', event);
    this.updateHistoryState();
  }

  // PDF operations
  async compressPdf(): Promise<void> {
    if (!this.document) return;

    try {
      const result = await this.pdfEngine.compressPdf(this.document, {
        quality: 'medium',
        optimizeImages: true,
        removeMetadata: false,
        removeBookmarks: false,
        removeComments: false
      });

      if (result.success && result.data) {
        this.document.currentVersion = result.data;
        this.document.fileSize = result.data.length;

        await this.historyService.captureSnapshot(
          this.document,
          'compress',
          'Compress PDF',
          'PDF compressed successfully'
        );

        alert(`PDF compressed successfully!`);
      }
    } catch (error) {
      console.error('Compression failed:', error);
      alert('Failed to compress PDF');
    }
  }

  async applyWatermark(): Promise<void> {
    if (!this.document || !this.watermarkConfig.text) return;

    try {
      const selectedPages = this.document.pages.filter(p => p.isSelected);
      const pageNumbers = selectedPages.length > 0
        ? selectedPages.map(p => p.pageNumber)
        : Array.from({ length: this.document.totalPages }, (_, i) => i + 1);

      const result = await this.pdfEngine.addWatermark(
        this.document,
        pageNumbers,
        this.watermarkConfig
      );

      if (result.success && result.data) {
        this.document.currentVersion = result.data;

        await this.historyService.captureSnapshot(
          this.document,
          'watermark',
          'Add Watermark',
          `Watermark added to ${pageNumbers.length} pages`
        );

        this.closeWatermarkDialog();
        alert('Watermark added successfully!');
      }
    } catch (error) {
      console.error('Failed to add watermark:', error);
      alert('Failed to add watermark');
    }
  }

  // Split operations
  async applySplit(): Promise<void> {
    if (!this.document || !this.isValidSplitConfig()) return;

    try {
      let splitConfig: any = {
        method: this.splitConfig.method,
        outputPrefix: this.splitConfig.outputPrefix
      };

      if (this.splitConfig.method === 'pages') {
        const pages = this.splitPagesInput.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
        splitConfig.pages = pages;
      } else if (this.splitConfig.method === 'range') {
        const ranges = this.splitRangesInput.split('\n')
          .map(line => line.trim())
          .filter(line => line.includes('-'))
          .map(line => {
            const [start, end] = line.split('-').map(p => parseInt(p.trim()));
            return { start, end };
          })
          .filter(range => !isNaN(range.start) && !isNaN(range.end));
        splitConfig.ranges = ranges;
      }

      const result = await this.pdfEngine.splitPdf(this.document, splitConfig);

      if (result.success && result.metadata?.results) {
        // Download all split files
        const results = result.metadata.results as Uint8Array[];
        results.forEach((pdfBytes, index) => {
          const filename = `${this.splitConfig.outputPrefix}_${index + 1}.pdf`;
          this.downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), filename);
        });

        await this.historyService.captureSnapshot(
          this.document,
          'split',
          'Split PDF',
          `PDF split into ${results.length} documents`
        );

        this.closeSplitDialog();
        alert(`PDF split into ${results.length} documents successfully!`);
      }
    } catch (error) {
      console.error('Failed to split PDF:', error);
      alert('Failed to split PDF');
    }
  }

  // Export operations
  async exportAsPdf(): Promise<void> {
    if (!this.document) return;

    try {
      // Start with the original clean PDF (without any annotations)
      let finalPdfData = this.document.originalFile ?
        new Uint8Array(await this.document.originalFile.arrayBuffer()) :
        this.document.currentVersion;

      // Apply annotations from all pages that have them
      const pagesWithAnnotations = this.document.pages.filter(page =>
        page.annotations && page.annotations.length > 0
      );

      if (pagesWithAnnotations.length > 0) {
        console.log(`Applying annotations from ${pagesWithAnnotations.length} pages for export...`);

        // Apply annotations for each page to the clean PDF
        for (const page of pagesWithAnnotations) {
          console.log(`Processing page ${page.pageNumber} with ${page.annotations.length} annotations`);

          // Create a temporary document with current PDF state
          const tempDocument = { ...this.document, currentVersion: finalPdfData };

          const result = await this.pdfEngine.applyAnnotations(tempDocument, page.id);

          if (result.success && result.data) {
            finalPdfData = result.data;
          } else {
            console.error(`Failed to apply annotations to page ${page.pageNumber}:`, result.error);
          }
        }
        console.log('Export: All annotations applied to clean PDF');
      } else {
        console.log('Export: No annotations found, using original PDF');
      }

      // Download the final PDF
      this.downloadBlob(new Blob([finalPdfData], { type: 'application/pdf' }), this.document.name);

    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export PDF');
    }
  }

  async exportAsImages(format: 'png' | 'jpg' | 'zip'): Promise<void> {
    if (!this.document) return;

    try {
      const selectedPages = this.document.pages.filter(p => p.isSelected);
      const config: ExportConfig = {
        format: format as any,
        pages: selectedPages.length > 0 ? selectedPages.map(p => p.pageNumber) : undefined,
        quality: 0.9,
        dpi: 150,
        includeAnnotations: true,
        fileName: this.document.name
      };

      const result = await this.pdfEngine.exportAsImages(this.document, config);

      if (format === 'zip' && result.zipBlob) {
        const filename = this.document.name.replace('.pdf', '_pages.zip');
        this.downloadBlob(result.zipBlob, filename);
        alert('Pages exported as ZIP successfully!');
      } else if (result.images.length > 0) {
        // Download individual images
        result.images.forEach((imageData, index) => {
          const pageNum = config.pages ? config.pages[index] : index + 1;
          const filename = `${this.document!.name.replace('.pdf', '')}_page_${pageNum}.${format}`;

          // Convert data URL to blob
          const link = document.createElement('a');
          link.href = imageData;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        });

        alert(`${result.images.length} image(s) exported successfully!`);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export images');
    }
  }

  // History operations
  async undo(): Promise<void> {
    if (!this.document) return;

    const snapshot = await this.historyService.undo(this.document.id);
    if (snapshot && snapshot.documentState) {
      this.document.currentVersion = snapshot.documentState;
      this.updateHistoryState();
    }
  }

  async redo(): Promise<void> {
    if (!this.document) return;

    const snapshot = await this.historyService.redo(this.document.id);
    if (snapshot && snapshot.documentState) {
      this.document.currentVersion = snapshot.documentState;
      this.updateHistoryState();
    }
  }

  // Preview methods
  showFullscreenPreview(): void {
    if (!this.document || !this.document.originalFile) return;

    this.previewFile = this.document.originalFile;
    this.showPreviewModal = true;
  }

  closePreview(): void {
    this.showPreviewModal = false;
    this.previewFile = null;
  }

  onPreviewError(error: string): void {
    console.error('Preview error:', error);
    alert(`Preview error: ${error}`);
  }

  // UI helpers
  closeWatermarkDialog(): void {
    this.showWatermarkDialog = false;
    this.watermarkConfig = {
      text: '',
      position: 'center',
      opacity: 0.3,
      fontSize: 36
    };
  }

  closeSplitDialog(): void {
    this.showSplitDialog = false;
    this.splitConfig = {
      method: 'pages',
      outputPrefix: 'document_part'
    };
    this.splitPagesInput = '';
    this.splitRangesInput = '';
  }

  isValidSplitConfig(): boolean {
    if (this.splitConfig.method === 'pages') {
      const pages = this.splitPagesInput.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
      return pages.length > 0 && pages.every(p => p > 0 && p <= (this.document?.totalPages || 0));
    } else if (this.splitConfig.method === 'range') {
      const ranges = this.splitRangesInput.split('\n')
        .map(line => line.trim())
        .filter(line => line.includes('-'))
        .map(line => {
          const [start, end] = line.split('-').map(p => parseInt(p.trim()));
          return { start, end, valid: !isNaN(start) && !isNaN(end) && start <= end };
        });
      return ranges.length > 0 && ranges.every(range => range.valid);
    }
    return false;
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  formatMemoryUsage(bytes: number): string {
    return this.formatFileSize(bytes);
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private updateHistoryState(): void {
    if (!this.document) return;

    const historyState = this.historyService.getHistoryState(this.document.id);
    this.canUndo = historyState.canUndo;
    this.canRedo = historyState.canRedo;
  }

  private updateProcessingMessage(processing: { [key: string]: boolean }): void {
    const activeOperations = Object.entries(processing)
      .filter(([_, active]) => active)
      .map(([operation]) => operation);

    if (activeOperations.length > 0) {
      const operationNames: { [key: string]: string } = {
        'load': 'Loading PDF...',
        'thumbnails': 'Generating thumbnails...',
        'rotate': 'Rotating pages...',
        'delete': 'Deleting pages...',
        'compress': 'Compressing PDF...',
        'watermark': 'Adding watermark...',
        'export': 'Exporting...'
      };

      this.processingMessage = operationNames[activeOperations[0]] || 'Processing...';
    }
  }

  private setupGlobalDragDrop(): void {
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      document.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, false);
    });

    // Handle drop
    document.addEventListener('drop', async (e) => {
      const files = Array.from(e.dataTransfer?.files || []) as File[];
      const pdfFiles = files.filter(file => file.type === 'application/pdf');

      if (pdfFiles.length > 0) {
        await this.loadPdfFile(pdfFiles[0]);
      }
    });
  }
}