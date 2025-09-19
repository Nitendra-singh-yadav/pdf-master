import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { PdfUtilsService } from '../services/pdf-utils.service';

@Component({
  selector: 'app-pdf-preview-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- PDF Preview Modal -->
    <div *ngIf="isVisible" class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 backdrop-blur-sm"
         (click)="closePreview()">
      <div class="bg-white rounded-xl shadow-2xl max-w-7xl max-h-[95vh] overflow-hidden flex flex-col w-full mx-4"
           (click)="$event.stopPropagation()">

        <!-- Header Controls -->
        <div class="flex flex-col space-y-3 p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <!-- Title Row -->
          <div class="flex justify-between items-center">
            <div>
              <h3 class="text-xl font-semibold text-gray-900 flex items-center">
                <span class="mr-2">📄</span>PDF Preview
              </h3>
              <p class="text-sm text-gray-600 mt-1" *ngIf="fileName">{{fileName}}</p>
            </div>
            <button
              (click)="closePreview()"
              class="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Close (Esc)"
            >
              <span class="text-xl">✕</span>
            </button>
          </div>

          <!-- Controls Row -->
          <div class="flex flex-wrap items-center justify-between gap-4">
            <!-- Page Navigation -->
            <div class="flex items-center space-x-3" *ngIf="previewPages.length > 0">
              <button
                (click)="previousPage()"
                [disabled]="currentPageIndex === 0"
                class="px-4 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                title="Previous Page (←)"
              >
                <span class="mr-1">←</span> Prev
              </button>

              <!-- Direct Page Input -->
              <div class="flex items-center space-x-2 bg-white rounded-lg px-3 py-2 border border-gray-300">
                <span class="text-sm text-gray-600">Page</span>
                <input
                  type="number"
                  [(ngModel)]="pageNumberInput"
                  (keyup.enter)="goToPageNumber()"
                  (blur)="goToPageNumber()"
                  [min]="1"
                  [max]="previewPages.length"
                  class="w-16 px-2 py-1 text-sm text-center border-none outline-none"
                >
                <span class="text-sm text-gray-600">of {{previewPages.length}}</span>
              </div>

              <button
                (click)="nextPage()"
                [disabled]="currentPageIndex === previewPages.length - 1"
                class="px-4 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                title="Next Page (→)"
              >
                Next <span class="ml-1">→</span>
              </button>
            </div>

            <!-- Zoom Controls -->
            <div class="flex items-center space-x-2 bg-white rounded-lg px-3 py-2 border border-gray-300">
              <button
                (click)="zoomOut()"
                [disabled]="zoomLevel <= 0.25"
                class="px-3 py-1 text-sm bg-gray-50 text-gray-700 rounded hover:bg-gray-100 disabled:opacity-50 transition-colors"
                title="Zoom Out (-)"
              >
                🔍-
              </button>
              <span class="text-sm font-medium w-12 text-center">{{(zoomLevel * 100).toFixed(0)}}%</span>
              <button
                (click)="zoomIn()"
                [disabled]="zoomLevel >= 3"
                class="px-3 py-1 text-sm bg-gray-50 text-gray-700 rounded hover:bg-gray-100 disabled:opacity-50 transition-colors"
                title="Zoom In (+)"
              >
                🔍+
              </button>
              <button
                (click)="resetZoom()"
                class="px-3 py-1 text-sm bg-gray-50 text-gray-700 rounded hover:bg-gray-100 transition-colors"
                title="Reset Zoom (0)"
              >
                Fit
              </button>
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center space-x-2">
              <button
                (click)="sharePreview()"
                class="px-4 py-2 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors flex items-center"
                title="Share PDF"
              >
                <span class="mr-1">📤</span> Share
              </button>
              <button
                (click)="downloadPreview()"
                class="px-4 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors flex items-center"
                title="Download PDF"
              >
                <span class="mr-1">⬇️</span> Download
              </button>
              <button
                (click)="printPreview()"
                class="px-4 py-2 text-sm bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors flex items-center"
                title="Print PDF"
              >
                <span class="mr-1">🖨️</span> Print
              </button>
              <button
                (click)="fullscreen()"
                class="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center"
                title="Fullscreen (F)"
              >
                <span class="mr-1">⛶</span> Fullscreen
              </button>
            </div>
          </div>
        </div>

        <!-- Preview Content -->
        <div class="flex-1 overflow-auto relative bg-gray-50"
             [class.overflow-hidden]="zoomLevel > 1 && isDragging"
             #previewContainer>
          <div
            *ngIf="currentPagePreview"
            class="min-h-full flex items-center justify-center p-6"
            [class.cursor-grab]="zoomLevel > 1 && !isDragging"
            [class.cursor-grabbing]="zoomLevel > 1 && isDragging"
            (mousedown)="zoomLevel > 1 ? startDrag($event) : null"
            (mousemove)="zoomLevel > 1 ? onDrag($event) : null"
            (mouseup)="endDrag()"
            (mouseleave)="endDrag()">

            <img
              [src]="currentPagePreview"
              [alt]="'PDF Preview - Page ' + (currentPageIndex + 1)"
              class="border border-gray-300 rounded-lg shadow-lg select-none max-w-full max-h-full"
              [style.transform]="getTransform()"
              [style.transition]="isDragging ? 'none' : 'transform 0.2s ease'"
              (dragstart)="$event.preventDefault()"
              (load)="onImageLoad()"
            >
          </div>

          <!-- Loading State -->
          <div *ngIf="isLoading && !currentPagePreview" class="flex items-center justify-center h-full">
            <div class="text-center">
              <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p class="text-gray-600 text-lg">Loading PDF preview...</p>
              <p class="text-gray-500 text-sm">This may take a moment for large files</p>
            </div>
          </div>

          <!-- Error State -->
          <div *ngIf="errorMessage" class="flex items-center justify-center h-full">
            <div class="text-center">
              <div class="text-6xl mb-4">⚠️</div>
              <p class="text-gray-600 text-lg mb-2">Failed to load PDF preview</p>
              <p class="text-gray-500 text-sm">{{errorMessage}}</p>
              <button
                (click)="retryPreview()"
                class="mt-4 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>

          <!-- Zoom indicator -->
          <div *ngIf="zoomLevel > 1" class="absolute top-4 right-4 bg-black bg-opacity-75 text-white px-3 py-2 rounded-lg text-sm font-medium">
            {{(zoomLevel * 100).toFixed(0)}}% - Drag to pan
          </div>

          <!-- Page indicator -->
          <div *ngIf="previewPages.length > 1" class="absolute bottom-4 left-4 bg-black bg-opacity-75 text-white px-3 py-2 rounded-lg text-sm font-medium">
            Page {{currentPageIndex + 1}} of {{previewPages.length}}
          </div>
        </div>

        <!-- Page Thumbnails -->
        <div *ngIf="previewPages.length > 1" class="border-t border-gray-200 p-4 bg-gray-50">
          <div class="flex space-x-3 overflow-x-auto pb-2" style="scroll-behavior: smooth;">
            <div
              *ngFor="let page of previewPages; let i = index"
              class="flex-shrink-0 cursor-pointer border-2 rounded-lg overflow-hidden transition-all duration-200"
              [class.border-blue-500]="i === currentPageIndex"
              [class.border-gray-300]="i !== currentPageIndex"
              [class.shadow-lg]="i === currentPageIndex"
              [class.scale-105]="i === currentPageIndex"
              (click)="goToPage(i)"
              [title]="'Go to page ' + (i + 1)"
            >
              <img
                [src]="page"
                [alt]="'Page ' + (i + 1)"
                class="w-16 h-20 object-cover"
              >
              <div class="text-xs text-center py-1 bg-white font-medium">{{i + 1}}</div>
            </div>
          </div>
        </div>

        <!-- Keyboard shortcuts info -->
        <div class="px-6 py-3 bg-gray-100 border-t border-gray-200">
          <div class="text-xs text-gray-600 text-center">
            <span class="font-medium">Shortcuts:</span>
            ← → Navigate • +/- Zoom • 0 Fit • F Fullscreen • Esc Close • Enter Go to page
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 1000;
    }

    .backdrop-blur-sm {
      backdrop-filter: blur(4px);
    }

    /* Custom scrollbar for thumbnails */
    .overflow-x-auto::-webkit-scrollbar {
      height: 6px;
    }

    .overflow-x-auto::-webkit-scrollbar-track {
      background: #f1f5f9;
      border-radius: 3px;
    }

    .overflow-x-auto::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 3px;
    }

    .overflow-x-auto::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }

    /* Smooth transitions */
    img {
      transition: transform 0.2s ease;
    }

    /* Loading animation enhancement */
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .animate-pulse {
      animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
  `]
})
export class PdfPreviewModalComponent implements OnInit, OnDestroy {
  @Input() isVisible = false;
  @Input() file: File | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() error = new EventEmitter<string>();

  // Preview state
  previewPages: string[] = [];
  currentPagePreview: string | null = null;
  currentPageIndex = 0;
  pageNumberInput = 1;
  isLoading = false;
  errorMessage: string | null = null;

  // Zoom and pan state
  zoomLevel = 1;
  isDragging = false;
  dragStartX = 0;
  dragStartY = 0;
  panX = 0;
  panY = 0;

  // Component lifecycle
  private destroy$ = new Subject<void>();

  constructor(private pdfUtils: PdfUtilsService) {}

  ngOnInit(): void {
    if (this.file && this.isVisible) {
      this.loadPreview();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cleanup();
  }

  // Getters
  get fileName(): string {
    return this.file?.name || '';
  }

  // Public methods
  async loadPreview(): Promise<void> {
    if (!this.file) return;

    this.isLoading = true;
    this.errorMessage = null;
    this.resetState();

    try {
      // Generate preview images using PDF.js
      const images = await this.pdfUtils.pdfToImages(this.file);

      if (images.length > 0) {
        this.previewPages = images;
        this.currentPagePreview = images[0];
        this.currentPageIndex = 0;
        this.pageNumberInput = 1;
      } else {
        throw new Error('No pages found in PDF');
      }
    } catch (error) {
      console.error('Error generating PDF preview:', error);
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load PDF preview';
      this.error.emit(this.errorMessage);
    } finally {
      this.isLoading = false;
    }
  }

  closePreview(): void {
    this.cleanup();
    this.closed.emit();
  }

  retryPreview(): void {
    this.loadPreview();
  }

  // Navigation methods
  nextPage(): void {
    if (this.currentPageIndex < this.previewPages.length - 1) {
      this.goToPage(this.currentPageIndex + 1);
    }
  }

  previousPage(): void {
    if (this.currentPageIndex > 0) {
      this.goToPage(this.currentPageIndex - 1);
    }
  }

  goToPage(pageIndex: number): void {
    if (pageIndex >= 0 && pageIndex < this.previewPages.length) {
      this.currentPageIndex = pageIndex;
      this.currentPagePreview = this.previewPages[pageIndex];
      this.pageNumberInput = pageIndex + 1;
      this.resetPan();
    }
  }

  goToPageNumber(): void {
    const pageNumber = this.pageNumberInput;
    if (pageNumber >= 1 && pageNumber <= this.previewPages.length) {
      this.goToPage(pageNumber - 1);
    } else {
      // Reset to current page if invalid input
      this.pageNumberInput = this.currentPageIndex + 1;
    }
  }

  // Zoom methods
  zoomIn(): void {
    if (this.zoomLevel < 3) {
      this.zoomLevel = Math.round((this.zoomLevel + 0.25) * 100) / 100;
      if (this.zoomLevel <= 1) {
        this.resetPan();
      }
    }
  }

  zoomOut(): void {
    if (this.zoomLevel > 0.25) {
      this.zoomLevel = Math.round((this.zoomLevel - 0.25) * 100) / 100;
      if (this.zoomLevel <= 1) {
        this.resetPan();
      }
    }
  }

  resetZoom(): void {
    this.zoomLevel = 1;
    this.resetPan();
  }

  // Drag and pan methods
  startDrag(event: MouseEvent): void {
    if (this.zoomLevel > 1) {
      event.preventDefault();
      this.isDragging = true;
      this.dragStartX = event.clientX - this.panX;
      this.dragStartY = event.clientY - this.panY;
    }
  }

  onDrag(event: MouseEvent): void {
    if (this.isDragging && this.zoomLevel > 1) {
      event.preventDefault();
      this.panX = event.clientX - this.dragStartX;
      this.panY = event.clientY - this.dragStartY;
    }
  }

  endDrag(): void {
    this.isDragging = false;
  }

  resetPan(): void {
    this.panX = 0;
    this.panY = 0;
    this.isDragging = false;
  }

  getTransform(): string {
    if (this.zoomLevel > 1) {
      return `scale(${this.zoomLevel}) translate(${this.panX / this.zoomLevel}px, ${this.panY / this.zoomLevel}px)`;
    }
    return 'scale(1)';
  }

  // Action methods
  async sharePreview(): Promise<void> {
    if (!this.file) return;

    try {
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [this.file] })) {
        await navigator.share({
          title: 'PDF Document',
          text: `Sharing ${this.file.name}`,
          files: [this.file]
        });
      } else {
        await this.copyLinkToClipboard();
      }
    } catch (error) {
      console.error('Error sharing:', error);
      await this.copyLinkToClipboard();
    }
  }

  downloadPreview(): void {
    if (!this.file) return;

    const url = URL.createObjectURL(this.file);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  printPreview(): void {
    if (!this.file) return;

    const url = URL.createObjectURL(this.file);
    const printWindow = window.open(url, '_blank');

    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
        printWindow.onafterprint = () => {
          printWindow.close();
          URL.revokeObjectURL(url);
        };
      };
    } else {
      window.open(url, '_blank');
    }
  }

  fullscreen(): void {
    const element = document.documentElement;
    if (element.requestFullscreen) {
      element.requestFullscreen();
    }
  }

  // Event handlers
  onImageLoad(): void {
    // Image loaded successfully
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardShortcuts(event: KeyboardEvent): void {
    if (!this.isVisible) return;

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.closePreview();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.previousPage();
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.nextPage();
        break;
      case '+':
      case '=':
        event.preventDefault();
        this.zoomIn();
        break;
      case '-':
        event.preventDefault();
        this.zoomOut();
        break;
      case '0':
        event.preventDefault();
        this.resetZoom();
        break;
      case 'f':
      case 'F':
        if (!event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          this.fullscreen();
        }
        break;
      case 'Enter':
        if (event.target instanceof HTMLInputElement && event.target.type === 'number') {
          event.preventDefault();
          this.goToPageNumber();
        }
        break;
    }
  }

  @HostListener('wheel', ['$event'])
  handleMouseWheel(event: WheelEvent): void {
    if (!this.isVisible) return;

    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      if (event.deltaY < 0) {
        this.zoomIn();
      } else {
        this.zoomOut();
      }
    }
  }

  // Private methods
  private async copyLinkToClipboard(): Promise<void> {
    try {
      const url = URL.createObjectURL(this.file!);
      await navigator.clipboard.writeText(url);

      // Show success message (you might want to emit an event for this)
      console.log('Link copied to clipboard');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  }

  private resetState(): void {
    this.previewPages = [];
    this.currentPagePreview = null;
    this.currentPageIndex = 0;
    this.pageNumberInput = 1;
    this.zoomLevel = 1;
    this.resetPan();
  }

  private cleanup(): void {
    // Clean up any object URLs to prevent memory leaks
    this.previewPages.forEach(url => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
    this.resetState();
  }
}