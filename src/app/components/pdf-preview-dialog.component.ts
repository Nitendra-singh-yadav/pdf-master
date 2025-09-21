import { Component, Inject, OnInit, OnDestroy, HostListener, ElementRef, ViewChild, AfterViewInit, ChangeDetectorRef } from '@angular/core';
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
import * as Hammer from 'hammerjs';

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
        <!-- Mobile Layout -->
        <div class="flex md:hidden items-center justify-between w-full">
          <span class="truncate text-sm max-w-[50%]">{{ data.title }}</span>

          <div class="flex items-center space-x-1">
            <!-- Navigation for mobile -->
            <div class="flex items-center space-x-1" *ngIf="previewPages.length > 1">
              <button mat-icon-button
                      (click)="previousPage()"
                      [disabled]="currentPageIndex === 0"
                      size="small">
                <mat-icon>chevron_left</mat-icon>
              </button>
              <span class="text-xs">{{ currentPageIndex + 1 }}/{{ previewPages.length }}</span>
              <button mat-icon-button
                      (click)="nextPage()"
                      [disabled]="currentPageIndex === previewPages.length - 1"
                      size="small">
                <mat-icon>chevron_right</mat-icon>
              </button>
            </div>

            <!-- Mobile actions -->
            <button mat-icon-button (click)="showMobileActions = !showMobileActions" size="small">
              <mat-icon>more_vert</mat-icon>
            </button>

            <button mat-icon-button (click)="closeDialog()" size="small">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </div>

        <!-- Desktop Layout -->
        <div class="hidden md:flex items-center justify-between w-full">
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
        </div>
      </mat-toolbar>

      <!-- Mobile Actions Dropdown -->
      <div *ngIf="showMobileActions" class="md:hidden bg-white border-b border-gray-200 p-2">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium">Controls</span>
          <button (click)="showMobileActions = false" class="text-gray-500">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <!-- Zoom controls -->
        <div class="flex items-center justify-center space-x-2 mb-3">
          <button mat-icon-button
                  (click)="zoomOut()"
                  [disabled]="zoomLevel <= 0.25">
            <mat-icon>zoom_out</mat-icon>
          </button>
          <span class="text-sm font-medium">{{ (zoomLevel * 100).toFixed(0) }}%</span>
          <button mat-icon-button
                  (click)="zoomIn()"
                  [disabled]="zoomLevel >= 3">
            <mat-icon>zoom_in</mat-icon>
          </button>
          <button mat-icon-button (click)="resetZoom()">
            <mat-icon>fit_screen</mat-icon>
          </button>
        </div>

        <!-- Action buttons -->
        <div class="flex items-center justify-center space-x-2">
          <button mat-icon-button
                  *ngIf="data.allowShare"
                  (click)="shareDocument(); showMobileActions = false">
            <mat-icon>share</mat-icon>
          </button>
          <button mat-icon-button
                  *ngIf="data.allowDownload"
                  (click)="downloadDocument(); showMobileActions = false">
            <mat-icon>download</mat-icon>
          </button>
          <button mat-icon-button
                  *ngIf="data.allowPrint"
                  (click)="printDocument(); showMobileActions = false">
            <mat-icon>print</mat-icon>
          </button>
        </div>
      </div>

      <!-- PDF Content Area -->
      <div class="flex-1 overflow-auto bg-gray-100 relative pdf-content-area"
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
               [style.transition]="isDragging || isGesturing ? 'none' : 'transform 0.2s ease'"
               (dragstart)="$event.preventDefault()"
               (load)="onImageLoad($event)">
        </div>

        <!-- Zoom Indicator -->
        <div *ngIf="zoomLevel !== 1"
             class="absolute top-4 right-4 bg-black bg-opacity-75 text-white px-3 py-2 rounded text-sm">
          {{ (zoomLevel * 100).toFixed(0) }}%<span *ngIf="zoomLevel > 1"> - Drag to pan</span>
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

    /* HammerJS gesture support */
    .pdf-content-area {
      touch-action: manipulation;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
      overflow: auto;
      -webkit-overflow-scrolling: touch;
      /* Ensure wheel events are captured */
      position: relative;
      z-index: 1;
    }

    /* Allow scrolling when not zoomed */
    .pdf-content-area.zoomed {
      touch-action: none;
      overflow: hidden;
    }

    /* Smooth zoom transitions */
    .pdf-content-area img {
      transition: transform 0.1s ease-out;
      transform-origin: center center;
      pointer-events: none;
    }

    /* Mobile-specific optimizations */
    @media (max-width: 768px) {
      .pdf-content-area {
        -webkit-overflow-scrolling: touch;
      }
    }
  `]
})
export class PdfPreviewDialogComponent implements OnInit, OnDestroy, AfterViewInit {

  @ViewChild('contentArea', { static: true }) contentArea!: ElementRef;
  // HammerJS gesture manager
  private hammerManager!: HammerManager;
  private initialZoomLevel = 1;
  isGesturing = false;

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
  originalImageWidth = 0;
  originalImageHeight = 0;


  // Mobile UI state
  showMobileActions = false;

  private destroy$ = new Subject<void>();

  constructor(
    private dialogRef: MatDialogRef<PdfPreviewDialogComponent, PdfPreviewResult>,
    @Inject(MAT_DIALOG_DATA) public data: PdfPreviewDialogData,
    private pdfUtils: PdfUtilsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadPreview();
  }

  ngAfterViewInit(): void {
    this.setupHammerGestures();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cleanup();

    // Clean up wheel event listener
    if (this.contentArea?.nativeElement) {
      this.contentArea.nativeElement.removeEventListener('wheel', this.handleContentAreaWheel);
    }

    // Clean up HammerJS
    if (this.hammerManager) {
      this.hammerManager.destroy();
    }
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
      // Reset original dimensions for new page
      this.originalImageWidth = 0;
      this.originalImageHeight = 0;
    }
  }

  // Zoom methods
  zoomIn(): void {
    if (this.zoomLevel < 3) {
      this.zoomLevel = Math.round((this.zoomLevel + 0.25) * 100) / 100;
      if (this.zoomLevel <= 1) {
        this.resetPan();
      }
      this.updateContentAreaClasses();
      this.cdr.detectChanges(); // Force change detection
    }
  }

  zoomOut(): void {
    if (this.zoomLevel > 0.25) {
      this.zoomLevel = Math.round((this.zoomLevel - 0.25) * 100) / 100;
      if (this.zoomLevel <= 1) {
        this.resetPan();
      }
      this.updateContentAreaClasses();
      this.cdr.detectChanges(); // Force change detection
    }
  }

  resetZoom(): void {
    this.fitToScreen();
  }

  fitToScreen(): void {
    const contentArea = document.querySelector('.pdf-content-area') as HTMLElement;
    if (!contentArea || !this.originalImageWidth || !this.originalImageHeight) {
      this.zoomLevel = 1;
      this.resetPan();
      this.updateContentAreaClasses();
      this.cdr.detectChanges();
      return;
    }

    // Get container dimensions with some padding
    const containerWidth = contentArea.clientWidth - 32; // 16px padding on each side
    const containerHeight = contentArea.clientHeight - 32;

    // Calculate zoom level to fit image in container
    const scaleX = containerWidth / this.originalImageWidth;
    const scaleY = containerHeight / this.originalImageHeight;

    // Use the smaller scale to ensure entire image fits
    this.zoomLevel = Math.min(scaleX, scaleY, 3); // Cap at max zoom of 3x
    this.resetPan();
    this.updateContentAreaClasses();
    this.cdr.detectChanges(); // Force change detection
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

  // Update content area classes based on zoom level
  private updateContentAreaClasses(): void {
    if (this.contentArea?.nativeElement) {
      const element = this.contentArea.nativeElement;
      if (this.zoomLevel > 1) {
        element.classList.add('zoomed');
      } else {
        element.classList.remove('zoomed');
      }
    }
  }

  getTransform(): string {
    if (this.zoomLevel > 1) {
      return `scale(${this.zoomLevel}) translate(${this.panX / this.zoomLevel}px, ${this.panY / this.zoomLevel}px)`;
    }
    return `scale(${this.zoomLevel})`;
  }

  // HammerJS gesture setup
  private setupHammerGestures(): void {
    if (!this.contentArea?.nativeElement) return;

    // Create HammerJS manager
    this.hammerManager = new Hammer.Manager(this.contentArea.nativeElement, {
      recognizers: [
        // Pinch gesture for zoom
        [Hammer.Pinch, { enable: true }],
        // Pan gesture for dragging (only when zoomed)
        [Hammer.Pan, { enable: true, direction: Hammer.DIRECTION_ALL }],
        // Tap gesture for double-tap zoom
        [Hammer.Tap, { taps: 2, enable: true }],
      ],
    });

    // Add wheel event listener specifically to the content area for trackpad zoom
    this.contentArea.nativeElement.addEventListener('wheel', this.handleContentAreaWheel, { passive: false });

    // Update content area classes based on zoom level
    this.updateContentAreaClasses();

    // Handle pinch to zoom
    this.hammerManager.on('pinchstart', (event: HammerInput) => {
      this.initialZoomLevel = this.zoomLevel;
      this.isGesturing = true;
    });

    this.hammerManager.on('pinchmove', (event: HammerInput) => {
      if (event.scale) {
        event.preventDefault();
        const newZoom = this.initialZoomLevel * event.scale;
        this.zoomLevel = Math.max(0.25, Math.min(3, newZoom));
        this.updateContentAreaClasses();
        this.cdr.detectChanges();
      }
    });

    // Handle pan for dragging when zoomed
    this.hammerManager.on('panstart', (event: HammerInput) => {
      // Only enable dragging when zoomed in
      if (this.zoomLevel > 1) {
        this.isDragging = true;
        this.isGesturing = true;
        this.dragStartX = event.center.x - this.panX;
        this.dragStartY = event.center.y - this.panY;
        event.preventDefault();
      }
    });

    this.hammerManager.on('panmove', (event: HammerInput) => {
      if (this.isDragging && this.zoomLevel > 1) {
        event.preventDefault();
        this.panX = event.center.x - this.dragStartX;
        this.panY = event.center.y - this.dragStartY;
        this.cdr.detectChanges();
      }
    });

    this.hammerManager.on('panend', () => {
      this.isDragging = false;
      this.isGesturing = false;
      this.updateContentAreaClasses();
    });

    // Add pinch end handler
    this.hammerManager.on('pinchend', () => {
      this.isGesturing = false;
      this.updateContentAreaClasses();
    });

    // Handle double-tap zoom
    this.hammerManager.on('tap', () => {
      if (this.zoomLevel <= 1) {
        this.zoomLevel = 2;
        this.resetPan();
      } else {
        this.fitToScreen();
      }
      this.updateContentAreaClasses();
      this.cdr.detectChanges();
    });
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

  onImageLoad(event?: Event): void {
    // Capture original image dimensions for fit-to-screen calculation
    if (event && event.target) {
      const img = event.target as HTMLImageElement;
      this.originalImageWidth = img.naturalWidth;
      this.originalImageHeight = img.naturalHeight;

      // Start at 100% zoom instead of auto-fitting to screen
      this.zoomLevel = 1;
      this.resetPan();
    }
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

  // Handle wheel events specifically on the content area
  private handleContentAreaWheel = (event: WheelEvent): void => {
    // Handle trackpad pinch-to-zoom and mouse wheel zoom
    if (event.ctrlKey || event.metaKey) {
      console.log('PDF Preview Zoom: Wheel event captured on content area', {
        deltaY: event.deltaY,
        ctrlKey: event.ctrlKey,
        target: event.target
      });
      event.preventDefault();
      event.stopPropagation();

      // Enhanced trackpad detection
      const absDeltaY = Math.abs(event.deltaY);
      const absDeltaX = Math.abs(event.deltaX);

      // Trackpad characteristics:
      // - Usually has fractional deltaY values
      // - Smaller delta values
      // - More precise control
      const isTrackpad = (
        absDeltaY % 1 !== 0 || // Has decimal places
        absDeltaY < 40 || // Small delta values
        (absDeltaX > 0 && absDeltaY < 100) // Has horizontal component with small vertical
      );

      // Different sensitivity for trackpad vs mouse wheel
      let zoomFactor: number;
      if (isTrackpad) {
        // More sensitive for trackpad pinch gestures (smooth zooming)
        zoomFactor = event.deltaY > 0 ? -0.015 : 0.015;
      } else {
        // Less sensitive for mouse wheel (step-based zooming)
        zoomFactor = event.deltaY > 0 ? -0.1 : 0.1;
      }

      let newZoom = this.zoomLevel + zoomFactor;
      newZoom = Math.max(0.25, Math.min(3, newZoom));

      if (newZoom !== this.zoomLevel) {
        this.zoomLevel = newZoom;
        if (this.zoomLevel <= 1) {
          this.resetPan();
        }
        this.updateContentAreaClasses();
        this.cdr.detectChanges();
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
