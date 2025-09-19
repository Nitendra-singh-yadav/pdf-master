import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, CdkDrag, CdkDropList, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';

import {
  PdfDocument,
  PdfPage,
  OperationSnapshot,
  getPageDisplaySize,
  OperationType
} from '../models/pdf-document.model';
import { PdfEngineService } from '../services/pdf-engine.service';
import { HistorySnapshotService, HistoryState } from '../services/history-snapshot.service';
import { LazyLoadingService } from '../services/lazy-loading.service';

export interface PageSelectionEvent {
  selectedPages: PdfPage[];
  allSelected: boolean;
  selectionCount: number;
}

export interface PageOperation {
  type: OperationType;
  pages: PdfPage[];
  config?: any;
}

@Component({
  selector: 'app-pdf-preview-grid',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  template: `
    <div class="pdf-preview-container" [class.loading]="isLoading">
      <!-- Header with Selection Controls -->
      <div class="preview-header bg-white border-b border-gray-200 p-4">
        <div class="flex items-center justify-between">
          <!-- Selection Info -->
          <div class="flex items-center space-x-4">
            <div class="flex items-center space-x-2">
              <input
                type="checkbox"
                [checked]="allPagesSelected"
                [indeterminate]="somePageSelected && !allPagesSelected"
                (change)="toggleSelectAll()"
                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              >
              <span class="text-sm font-medium text-gray-700">
                {{selectedPagesCount}} of {{document.totalPages}} selected
              </span>
            </div>

            <!-- View Mode Toggle -->
            <div class="flex items-center space-x-2 ml-8">
              <button
                (click)="viewMode = 'grid'"
                [class.bg-blue-100]="viewMode === 'grid'"
                [class.text-blue-700]="viewMode === 'grid'"
                class="px-3 py-1 text-sm border border-gray-300 rounded-l-lg hover:bg-gray-50 transition-colors"
              >
                Grid
              </button>
              <button
                (click)="viewMode = 'list'"
                [class.bg-blue-100]="viewMode === 'list'"
                [class.text-blue-700]="viewMode === 'list'"
                class="px-3 py-1 text-sm border border-gray-300 rounded-r-lg hover:bg-gray-50 transition-colors"
              >
                List
              </button>
            </div>

            <!-- Page Size Slider -->
            <div class="flex items-center space-x-2 ml-4">
              <span class="text-xs text-gray-500">Size:</span>
              <input
                type="range"
                min="100"
                max="300"
                step="20"
                [(ngModel)]="thumbnailSize"
                (input)="onThumbnailSizeChange()"
                class="w-20"
              >
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex items-center space-x-2">
            <button
              *ngIf="selectedPagesCount > 0"
              (click)="rotateSelectedPages(90)"
              class="px-3 py-1 text-sm bg-blue-100 text-blue-700 border border-blue-300 rounded hover:bg-blue-200 transition-colors"
              title="Rotate selected pages 90°"
            >
              🔄 Rotate
            </button>

            <button
              *ngIf="selectedPagesCount > 0"
              (click)="deleteSelectedPages()"
              class="px-3 py-1 text-sm bg-red-100 text-red-700 border border-red-300 rounded hover:bg-red-200 transition-colors"
              title="Delete selected pages"
            >
              🗑️ Delete
            </button>

            <button
              *ngIf="selectedPagesCount > 1"
              (click)="extractSelectedPages()"
              class="px-3 py-1 text-sm bg-green-100 text-green-700 border border-green-300 rounded hover:bg-green-200 transition-colors"
              title="Extract selected pages to new PDF"
            >
              📄 Extract
            </button>
          </div>
        </div>
      </div>

      <!-- Loading Overlay -->
      <div *ngIf="isLoading" class="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p class="text-gray-600">{{loadingMessage}}</p>
          <div *ngIf="loadingProgress > 0" class="w-48 bg-gray-200 rounded-full h-2 mx-auto mt-2">
            <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" [style.width.%]="loadingProgress"></div>
          </div>
        </div>
      </div>

      <!-- PDF Pages Grid -->
      <div
        class="pages-container p-4"
        [class.grid-view]="viewMode === 'grid'"
        [class.list-view]="viewMode === 'list'"
        #container
      >
        <!-- Grid View -->
        <div
          *ngIf="viewMode === 'grid'"
          cdkDropList
          (cdkDropListDropped)="onPageReorder($event)"
          class="grid gap-4"
          [style.grid-template-columns]="gridTemplateColumns"
        >
          <div
            *ngFor="let page of document.pages; let i = index; trackBy: trackByPageId"
            cdkDrag
            [cdkDragData]="page"
            [class.selected]="page.isSelected"
            [class.dragging]="isDragging"
            class="page-item bg-white border-2 border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer relative"
            [style.width.px]="thumbnailSize"
            (click)="togglePageSelection(page, $event)"
            (dblclick)="editPage(page)"
          >
            <!-- Page Number Badge -->
            <div class="absolute top-2 left-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded z-10">
              {{page.pageNumber}}
            </div>

            <!-- Selection Checkbox -->
            <div class="absolute top-2 right-2 z-10">
              <input
                type="checkbox"
                [checked]="page.isSelected"
                (click)="$event.stopPropagation()"
                (change)="togglePageSelection(page, $event)"
                class="w-4 h-4 text-blue-600 border-2 border-white rounded focus:ring-blue-500 shadow-lg"
              >
            </div>

            <!-- Page Thumbnail -->
            <div class="relative">
              <img
                *ngIf="getPageThumbnail(page)"
                [src]="getPageThumbnail(page)"
                [alt]="'Page ' + page.pageNumber"
                class="w-full h-auto rounded-lg"
                [class.opacity-75]="!page.isVisible"
                (load)="onThumbnailLoad(page)"
                (error)="onThumbnailError(page)"
                #pageElement
              >

              <!-- Placeholder for loading thumbnails -->
              <div
                *ngIf="!getPageThumbnail(page)"
                class="flex items-center justify-center bg-gray-100 rounded-lg aspect-[3/4]"
              >
                <div class="text-center" *ngIf="isPageLoading(page)">
                  <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <span class="text-xs text-gray-500">Loading...</span>
                </div>
                <div class="text-center" *ngIf="!isPageLoading(page) && shouldShowPlaceholder(page)">
                  <div class="h-8 w-8 bg-gray-300 rounded mx-auto mb-2 flex items-center justify-center">
                    <span class="text-xs text-gray-600">{{page.pageNumber}}</span>
                  </div>
                  <span class="text-xs text-gray-500">Page {{page.pageNumber}}</span>
                </div>
              </div>

              <!-- Page Modifications Indicator -->
              <div *ngIf="page.modifications.length > 0" class="absolute bottom-2 left-2">
                <div class="flex space-x-1">
                  <span
                    *ngFor="let mod of page.modifications"
                    class="w-2 h-2 rounded-full"
                    [class.bg-yellow-500]="mod.type === 'rotate'"
                    [class.bg-blue-500]="mod.type === 'crop'"
                    [class.bg-purple-500]="mod.type === 'watermark'"
                    [class.bg-green-500]="mod.type === 'overlay'"
                    [title]="mod.type"
                  ></span>
                </div>
              </div>

              <!-- Rotation Indicator -->
              <div *ngIf="page.rotation !== 0" class="absolute bottom-2 right-2">
                <span class="bg-yellow-500 text-white text-xs px-1 rounded">{{page.rotation}}°</span>
              </div>
            </div>

            <!-- Page Info -->
            <div class="p-2 text-center">
              <p class="text-xs text-gray-600 truncate">
                Page {{page.pageNumber}}
                <span *ngIf="page.modifications.length > 0" class="text-blue-600">
                  • Modified
                </span>
              </p>
            </div>

            <!-- Drag Handle -->
            <div cdkDragHandle class="absolute inset-0 cursor-move opacity-0 hover:opacity-100 bg-blue-500 bg-opacity-20 transition-opacity">
              <div class="flex items-center justify-center h-full">
                <span class="text-white text-lg font-bold">⋮⋮</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div *ngIf="document.pages.length === 0" class="text-center py-12">
          <div class="text-6xl mb-4">📄</div>
          <h3 class="text-lg font-medium text-gray-900 mb-2">No pages to display</h3>
          <p class="text-gray-500">Upload a PDF file to see pages here</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .pdf-preview-container {
      position: relative;
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    .pages-container {
      flex: 1;
      overflow-y: auto;
    }

    .grid-view .grid {
      justify-items: center;
    }

    .page-item {
      border-width: 2px;
      transition: all 0.2s ease;
    }

    .page-item.selected {
      border-color: #3B82F6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .page-item:hover {
      transform: translateY(-2px);
    }

    .page-item.dragging {
      opacity: 0.7;
      transform: rotate(5deg);
    }

    .aspect-\\[3\\/4\\] {
      aspect-ratio: 3 / 4;
    }

    .loading {
      pointer-events: none;
    }
  `]
})
export class PdfPreviewGridComponent implements OnInit, OnDestroy {
  @Input() document!: PdfDocument;
  @Input() showHistoryTimeline: boolean = true;
  @Input() enableDragDrop: boolean = true;
  @Input() selectionMode: 'single' | 'multiple' = 'multiple';

  @Output() pageSelectionChange = new EventEmitter<PageSelectionEvent>();
  @Output() pageOperation = new EventEmitter<PageOperation>();
  @Output() pageEdit = new EventEmitter<PdfPage>();
  @Output() pageReorder = new EventEmitter<{ fromIndex: number; toIndex: number }>();

  @ViewChild('container', { static: false }) containerRef!: ElementRef;

  // View state
  viewMode: 'grid' | 'list' = 'grid';
  thumbnailSize = 200;
  isLoading = false;
  loadingMessage = '';
  loadingProgress = 0;
  isDragging = false;

  // History state
  historyState: HistoryState | null = null;

  private destroy$ = new Subject<void>();
  private thumbnailSizeSubject = new BehaviorSubject<number>(200);

  constructor(
    private pdfEngine: PdfEngineService,
    private historyService: HistorySnapshotService,
    private lazyLoading: LazyLoadingService
  ) {}

  ngOnInit(): void {
    // Initialize history tracking
    this.historyService.initializeHistory(this.document);

    // Initialize lazy loading for large documents
    this.lazyLoading.optimizeForLargeDocument(this.document);

    // Subscribe to processing state
    this.pdfEngine.processing$
      .pipe(takeUntil(this.destroy$))
      .subscribe(processing => {
        this.isLoading = Object.values(processing).some(p => p);
        this.updateLoadingMessage(processing);
      });

    // Subscribe to progress updates
    this.pdfEngine.progress$
      .pipe(takeUntil(this.destroy$))
      .subscribe(progress => {
        const activeProgress = Object.values(progress).find(p => p > 0);
        this.loadingProgress = activeProgress || 0;
      });

    // Subscribe to lazy loading viewport changes
    this.lazyLoading.viewport$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadVisibleThumbnails();
        this.unloadDistantThumbnails();
      });

    // Handle thumbnail size changes with debouncing
    this.thumbnailSizeSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(size => {
        this.updateGridLayout();
        this.generateVisibleThumbnails();
      });

    // Generate initial thumbnails
    this.generateInitialThumbnails();

    // Initialize viewport tracking after container is ready
    setTimeout(() => this.initializeViewportTracking(), 100);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.lazyLoading.destroy();
  }

  // Grid layout calculations
  get gridTemplateColumns(): string {
    const containerWidth = this.containerRef?.nativeElement?.clientWidth || 1000;
    const itemWidth = this.thumbnailSize + 32; // Include padding/margin
    const columns = Math.floor(containerWidth / itemWidth) || 1;
    return `repeat(${columns}, 1fr)`;
  }

  // Selection state getters
  get selectedPages(): PdfPage[] {
    return this.document.pages.filter(p => p.isSelected);
  }

  get selectedPagesCount(): number {
    return this.selectedPages.length;
  }

  get allPagesSelected(): boolean {
    return this.document.pages.length > 0 && this.document.pages.every(p => p.isSelected);
  }

  get somePageSelected(): boolean {
    return this.selectedPages.length > 0;
  }

  // Event handlers
  togglePageSelection(page: PdfPage, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }

    if (this.selectionMode === 'single') {
      // Clear all other selections in single mode
      this.document.pages.forEach(p => p.isSelected = false);
    }

    page.isSelected = !page.isSelected;
    this.emitSelectionChange();
  }

  toggleSelectAll(): void {
    const shouldSelectAll = !this.allPagesSelected;
    this.document.pages.forEach(page => page.isSelected = shouldSelectAll);
    this.emitSelectionChange();
  }

  onPageReorder(event: CdkDragDrop<PdfPage[]>): void {
    if (event.previousIndex !== event.currentIndex) {
      moveItemInArray(this.document.pages, event.previousIndex, event.currentIndex);

      // Update page numbers after reordering
      this.document.pages.forEach((page, index) => {
        page.pageNumber = index + 1;
      });

      this.pageReorder.emit({
        fromIndex: event.previousIndex,
        toIndex: event.currentIndex
      });

      // Capture history snapshot
      this.captureHistorySnapshot('reorder', 'Reorder Pages', 'Pages reordered');
    }
  }

  onThumbnailSizeChange(): void {
    this.thumbnailSizeSubject.next(this.thumbnailSize);
  }

  onThumbnailLoad(page: PdfPage): void {
    page.isVisible = true;
  }

  onThumbnailError(page: PdfPage): void {
    console.error(`Failed to load thumbnail for page ${page.pageNumber}`);
  }

  // Page operations
  async rotateSelectedPages(angle: number, pages?: PdfPage[]): Promise<void> {
    const pagesToRotate = pages || this.selectedPages;
    if (pagesToRotate.length === 0) return;

    try {
      const pageNumbers = pagesToRotate.map(p => p.pageNumber);
      const result = await this.pdfEngine.rotatePages(this.document, pageNumbers, angle);

      if (result.success && result.data) {
        // Update document
        this.document.currentVersion = result.data;

        // Update page rotations
        pagesToRotate.forEach(page => {
          page.rotation = (page.rotation + angle) % 360;
        });

        // Regenerate thumbnails for rotated pages
        await this.regenerateThumbnails(pagesToRotate);

        this.captureHistorySnapshot('rotate', 'Rotate Pages', `Rotated ${pagesToRotate.length} pages by ${angle}°`);

        this.pageOperation.emit({
          type: 'rotate',
          pages: pagesToRotate,
          config: { angle }
        });
      }
    } catch (error) {
      console.error('Failed to rotate pages:', error);
    }
  }

  async deleteSelectedPages(): Promise<void> {
    const pagesToDelete = this.selectedPages;
    if (pagesToDelete.length === 0) return;

    if (pagesToDelete.length >= this.document.totalPages) {
      alert('Cannot delete all pages from the document.');
      return;
    }

    const confirmed = confirm(`Delete ${pagesToDelete.length} selected page(s)?`);
    if (!confirmed) return;

    try {
      const pageNumbers = pagesToDelete.map(p => p.pageNumber);
      const result = await this.pdfEngine.deletePages(this.document, pageNumbers);

      if (result.success && result.data) {
        // Update document
        this.document.currentVersion = result.data;

        // Remove deleted pages from array
        this.document.pages = this.document.pages.filter(p => !p.isSelected);
        this.document.totalPages = this.document.pages.length;

        // Renumber remaining pages
        this.document.pages.forEach((page, index) => {
          page.pageNumber = index + 1;
        });

        this.captureHistorySnapshot('delete', 'Delete Pages', `Deleted ${pagesToDelete.length} pages`);

        this.pageOperation.emit({
          type: 'delete',
          pages: pagesToDelete
        });

        this.emitSelectionChange();
      }
    } catch (error) {
      console.error('Failed to delete pages:', error);
    }
  }

  async extractSelectedPages(): Promise<void> {
    const pagesToExtract = this.selectedPages;
    if (pagesToExtract.length === 0) return;

    this.pageOperation.emit({
      type: 'extract',
      pages: pagesToExtract
    });
  }

  editPage(page: PdfPage): void {
    this.pageEdit.emit(page);
  }

  // Lazy loading methods
  initializeViewportTracking(): void {
    if (this.containerRef?.nativeElement) {
      this.lazyLoading.initializeViewport(this.containerRef.nativeElement, this.thumbnailSize + 50);
    }
  }

  getPageThumbnail(page: PdfPage): string | null {
    // First check lazy loading cache
    const cached = this.lazyLoading.getThumbnail(page.id);
    if (cached) return cached;

    // Fall back to page thumbnail
    return page.thumbnail || null;
  }

  isPageLoading(page: PdfPage): boolean {
    return this.lazyLoading.isPageLoading(page.id);
  }

  shouldShowPlaceholder(page: PdfPage): boolean {
    return this.lazyLoading.shouldLoadPage(page.pageNumber - 1, this.document.totalPages);
  }

  private async loadVisibleThumbnails(): Promise<void> {
    const pagesToLoad = this.lazyLoading.getPagesToLoad(this.document);

    for (const page of pagesToLoad) {
      this.lazyLoading.setPageLoading(page.id, true);

      try {
        // Generate thumbnail for this specific page
        const updatedPages = await this.pdfEngine.generateThumbnails(
          this.document,
          {
            width: this.thumbnailSize,
            startPage: page.pageNumber,
            endPage: page.pageNumber
          }
        );

        if (updatedPages[page.pageNumber - 1]?.thumbnail) {
          const thumbnail = updatedPages[page.pageNumber - 1].thumbnail;
          page.thumbnail = thumbnail;
          this.lazyLoading.cacheThumbnail(page.id, thumbnail, 'high');
        }
      } catch (error) {
        console.error(`Failed to load thumbnail for page ${page.pageNumber}:`, error);
      } finally {
        this.lazyLoading.setPageLoading(page.id, false);
      }
    }
  }

  private unloadDistantThumbnails(): void {
    const pagesToUnload = this.lazyLoading.getPagesToUnload(this.document);

    pagesToUnload.forEach(pageId => {
      // Find the page and clear its thumbnail
      const page = this.document.pages.find(p => p.id === pageId);
      if (page) {
        page.thumbnail = '';
        page.isVisible = false;
      }

      // Remove from lazy loading cache
      this.lazyLoading.removeCachedThumbnail(pageId);
    });
  }

  // Utility methods
  trackByPageId(index: number, page: PdfPage): string {
    return page.id;
  }

  private async generateInitialThumbnails(): Promise<void> {
    try {
      this.loadingMessage = 'Generating thumbnails...';

      // For large documents, only generate thumbnails for visible pages initially
      if (this.document.totalPages > 50) {
        // Load first few pages immediately
        const initialPageCount = Math.min(10, this.document.totalPages);

        const updatedPages = await this.pdfEngine.generateThumbnails(
          this.document,
          {
            width: this.thumbnailSize,
            startPage: 1,
            endPage: initialPageCount,
            onProgress: (progress) => {
              this.loadingProgress = (progress.completed / progress.total) * 100;
              this.loadingMessage = `Generating initial thumbnails... ${progress.completed}/${progress.total}`;
            }
          }
        );

        // Update initial pages and cache them
        for (let i = 0; i < initialPageCount; i++) {
          if (updatedPages[i]?.thumbnail) {
            this.document.pages[i].thumbnail = updatedPages[i].thumbnail;
            this.lazyLoading.cacheThumbnail(this.document.pages[i].id, updatedPages[i].thumbnail, 'high');
          }
        }

        // Load visible pages after initial load
        setTimeout(() => this.loadVisibleThumbnails(), 100);
      } else {
        // For smaller documents, generate all thumbnails
        const updatedPages = await this.pdfEngine.generateThumbnails(
          this.document,
          {
            width: this.thumbnailSize,
            onProgress: (progress) => {
              this.loadingProgress = (progress.completed / progress.total) * 100;
              this.loadingMessage = `Generating thumbnails... ${progress.completed}/${progress.total}`;
            }
          }
        );

        this.document.pages = updatedPages;

        // Cache all thumbnails
        updatedPages.forEach(page => {
          if (page.thumbnail) {
            this.lazyLoading.cacheThumbnail(page.id, page.thumbnail, 'medium');
          }
        });
      }
    } catch (error) {
      console.error('Failed to generate thumbnails:', error);
    }
  }

  private async generateVisibleThumbnails(): Promise<void> {
    // Use the loadVisibleThumbnails method for consistency
    await this.loadVisibleThumbnails();
  }

  private async regenerateThumbnails(pages: PdfPage[]): Promise<void> {
    for (const page of pages) {
      page.thumbnail = '';
    }

    const startPage = Math.min(...pages.map(p => p.pageNumber));
    const endPage = Math.max(...pages.map(p => p.pageNumber));

    await this.pdfEngine.generateThumbnails(this.document, {
      width: this.thumbnailSize,
      startPage,
      endPage
    });
  }

  private emitSelectionChange(): void {
    this.pageSelectionChange.emit({
      selectedPages: this.selectedPages,
      allSelected: this.allPagesSelected,
      selectionCount: this.selectedPagesCount
    });
  }

  private updateGridLayout(): void {
    setTimeout(() => {
      // Force re-calculation
    });
  }

  private updateLoadingMessage(processing: { [key: string]: boolean }): void {
    const activeOperations = Object.entries(processing)
      .filter(([_, active]) => active)
      .map(([operation]) => operation);

    if (activeOperations.length > 0) {
      const operationNames: { [key: string]: string } = {
        'load': 'Loading PDF...',
        'thumbnails': 'Generating thumbnails...',
        'rotate': 'Rotating pages...',
        'delete': 'Deleting pages...',
        'merge': 'Merging PDFs...',
        'split': 'Splitting PDF...',
        'compress': 'Compressing PDF...',
        'watermark': 'Adding watermark...',
        'export': 'Exporting...'
      };

      this.loadingMessage = operationNames[activeOperations[0]] || 'Processing...';
    }
  }

  private async captureHistorySnapshot(
    operationType: OperationType,
    operationName: string,
    description: string
  ): Promise<void> {
    const affectedPages = this.selectedPages.map(p => p.id);
    await this.historyService.captureSnapshot(
      this.document,
      operationType,
      operationName,
      description,
      affectedPages
    );
  }
}