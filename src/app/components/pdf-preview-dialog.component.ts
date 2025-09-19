import { Component, Inject, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSliderModule } from '@angular/material/slider';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { PdfUtilsService } from '../services/pdf-utils.service';
import { PdfPreviewResult } from '../services/pdf-preview-dialog.service';

export interface PdfPreviewDialogData {
  file: File;
  title: string;
  allowDownload: boolean;
  allowPrint: boolean;
  allowShare: boolean;
}

@Component({
  selector: 'app-pdf-preview-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    MatSliderModule
  ],
  template: `
    <div class="pdf-preview-dialog h-full flex flex-col">
      <!-- Header Toolbar -->
      <mat-toolbar color="primary" class="flex-shrink-0">
        <span class="flex-1 truncate">{{ data.title }}</span>

        <!-- Navigation Controls -->
        <div class="flex items-center space-x-2 mx-4" *ngIf="previewPages.length > 1">
          <button mat-icon-button
                  (click)="previousPage()"
                  [disabled]="currentPageIndex === 0"
                  title="Previous Page">
            <mat-icon>chevron_left</mat-icon>
          </button>

          <span class="text-sm whitespace-nowrap">
            Page {{ currentPageIndex + 1 }} of {{ previewPages.length }}
          </span>

          <button mat-icon-button
                  (click)="nextPage()"
                  [disabled]="currentPageIndex === previewPages.length - 1"
                  title="Next Page">
            <mat-icon>chevron_right</mat-icon>
          </button>
        </div>

        <!-- Zoom Controls -->
        <div class="flex items-center space-x-2 mx-4">
          <button mat-icon-button
                  (click)="zoomOut()"
                  [disabled]="zoomLevel <= 0.25"
                  title="Zoom Out">
            <mat-icon>zoom_out</mat-icon>
          </button>

          <span class="text-sm w-12 text-center">{{ (zoomLevel * 100).toFixed(0) }}%</span>

          <button mat-icon-button
                  (click)="zoomIn()"
                  [disabled]="zoomLevel >= 3"
                  title="Zoom In">
            <mat-icon>zoom_in</mat-icon>
          </button>

          <button mat-icon-button
                  (click)="resetZoom()"
                  title="Fit to Screen">
            <mat-icon>fit_screen</mat-icon>
          </button>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center space-x-1">
          <button mat-icon-button
                  *ngIf="data.allowShare"
                  (click)="shareDocument()"
                  title="Share">
            <mat-icon>share</mat-icon>
          </button>

          <button mat-icon-button
                  *ngIf="data.allowDownload"
                  (click)="downloadDocument()"
                  title="Download">
            <mat-icon>download</mat-icon>
          </button>

          <button mat-icon-button
                  *ngIf="data.allowPrint"
                  (click)="printDocument()"
                  title="Print">
            <mat-icon>print</mat-icon>
          </button>

          <button mat-icon-button
                  (click)="closeDialog()"
                  title="Close">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </mat-toolbar>

      <!-- PDF Content Area -->
      <div class="flex-1 overflow-auto bg-gray-100 relative"
           #contentArea
           [class.cursor-grab]="zoomLevel > 1 && !isDragging"
           [class.cursor-grabbing]="zoomLevel > 1 && isDragging"
           (mousedown)="zoomLevel > 1 ? startDrag($event) : null"
           (mousemove)="zoomLevel > 1 ? onDrag($event) : null"
           (mouseup)="endDrag()"
           (mouseleave)="endDrag()">

        <!-- Loading State -->
        <div *ngIf="isLoading" class="flex items-center justify-center h-full">
          <div class="text-center">
            <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p class="text-gray-700 text-lg">Loading PDF preview...</p>
          </div>
        </div>

        <!-- Error State -->
        <div *ngIf="errorMessage" class="flex items-center justify-center h-full">
          <div class="text-center max-w-md">
            <mat-icon class="text-6xl text-gray-400 mb-4">error_outline</mat-icon>
            <h3 class="text-xl text-gray-700 mb-2">Failed to load PDF preview</h3>
            <p class="text-gray-500 mb-4">{{ errorMessage }}</p>
            <button mat-raised-button color="primary" (click)="retryLoad()">
              Try Again
            </button>
          </div>
        </div>

        <!-- PDF Page Display -->
        <div *ngIf="currentPagePreview && !isLoading && !errorMessage"
             class="flex items-center justify-center min-h-full p-4">
          <img [src]="currentPagePreview"
               [alt]="'PDF Preview - Page ' + (currentPageIndex + 1)"
               class="max-w-full max-h-full object-contain shadow-lg"
               [style.transform]="getTransform()"
               [style.transition]="isDragging ? 'none' : 'transform 0.2s ease'"
               (dragstart)="$event.preventDefault()"
               (load)="onImageLoad()">
        </div>

        <!-- Zoom Indicator -->
        <div *ngIf="zoomLevel > 1"
             class="absolute top-4 right-4 bg-black bg-opacity-75 text-white px-3 py-2 rounded text-sm">
          {{ (zoomLevel * 100).toFixed(0) }}% - Drag to pan
        </div>
      </div>

      <!-- Page Thumbnails (for multi-page PDFs) -->
      <div *ngIf="previewPages.length > 1"
           class="flex-shrink-0 border-t border-gray-300 bg-white p-3">
        <div class="flex space-x-2 overflow-x-auto pb-2">
          <div *ngFor="let page of previewPages; let i = index"
               class="flex-shrink-0 cursor-pointer border-2 rounded overflow-hidden transition-all duration-200"
               [class.border-blue-500]="i === currentPageIndex"
               [class.border-gray-300]="i !== currentPageIndex"
               [class.shadow-md]="i === currentPageIndex"
               (click)="goToPage(i)"
               [title]="'Go to page ' + (i + 1)">
            <img [src]="page"
                 [alt]="'Page ' + (i + 1)"
                 class="w-16 h-20 object-cover">
            <div class="text-xs text-center py-1 bg-white font-medium">{{ i + 1 }}</div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .pdf-preview-dialog {
      padding: 0;
    }

    :host ::ng-deep .mat-mdc-dialog-container {
      padding: 0;
    }

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
  `]
})
export class PdfPreviewDialogComponent implements OnInit, OnDestroy {

  // Preview state
  previewPages: string[] = [];
  currentPagePreview: string | null = null;
  currentPageIndex = 0;
  isLoading = false;
  errorMessage: string | null = null;

  // Zoom and pan state
  zoomLevel = 1;
  isDragging = false;
  dragStartX = 0;
  dragStartY = 0;
  panX = 0;
  panY = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private dialogRef: MatDialogRef<PdfPreviewDialogComponent, PdfPreviewResult>,
    @Inject(MAT_DIALOG_DATA) public data: PdfPreviewDialogData,
    private pdfUtils: PdfUtilsService
  ) {}

  ngOnInit(): void {
    this.loadPreview();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cleanup();
  }

  async loadPreview(): Promise<void> {
    if (!this.data.file) return;

    this.isLoading = true;
    this.errorMessage = null;

    try {
      const images = await this.pdfUtils.pdfToImages(this.data.file);

      if (images.length > 0) {
        this.previewPages = images;
        this.currentPagePreview = images[0];
        this.currentPageIndex = 0;
      } else {
        throw new Error('No pages found in PDF');
      }
    } catch (error) {
      console.error('Error generating PDF preview:', error);
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load PDF preview';
    } finally {
      this.isLoading = false;
    }
  }

  retryLoad(): void {
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
      this.resetPan();
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
  async shareDocument(): Promise<void> {
    try {
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [this.data.file] })) {
        await navigator.share({
          title: 'PDF Document',
          text: `Sharing ${this.data.file.name}`,
          files: [this.data.file]
        });
        this.dialogRef.close({ action: 'share', file: this.data.file });
      } else {
        // Fallback: copy link or show share options
        this.downloadDocument();
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }

  downloadDocument(): void {
    const url = URL.createObjectURL(this.data.file);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.data.file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.dialogRef.close({ action: 'download', file: this.data.file });
  }

  printDocument(): void {
    const url = URL.createObjectURL(this.data.file);
    const printWindow = window.open(url, '_blank');

    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
        printWindow.onafterprint = () => {
          printWindow.close();
          URL.revokeObjectURL(url);
        };
      };
      this.dialogRef.close({ action: 'print', file: this.data.file });
    }
  }

  closeDialog(): void {
    this.dialogRef.close({ action: 'close' });
  }

  onImageLoad(): void {
    // Image loaded successfully
  }

  @HostListener('keydown', ['$event'])
  handleKeyboardShortcuts(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.closeDialog();
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
    }
  }

  @HostListener('wheel', ['$event'])
  handleMouseWheel(event: WheelEvent): void {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      if (event.deltaY < 0) {
        this.zoomIn();
      } else {
        this.zoomOut();
      }
    }
  }

  private cleanup(): void {
    // Clean up any object URLs to prevent memory leaks
    this.previewPages.forEach(url => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });
  }
}