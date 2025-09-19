import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { PdfDocument, PdfPage } from '../models/pdf-document.model';

export interface ViewportInfo {
  top: number;
  bottom: number;
  height: number;
  itemHeight: number;
  visibleStartIndex: number;
  visibleEndIndex: number;
  bufferSize: number;
}

export interface LazyLoadingConfig {
  enabled: boolean;
  thumbnailQuality: 'low' | 'medium' | 'high';
  preloadBuffer: number; // Number of pages to preload before/after visible area
  unloadDistance: number; // Distance in pages before unloading thumbnails
  maxCachedThumbnails: number;
  virtualScrolling: boolean;
  chunkSize: number; // Number of pages to load in each chunk
}

export interface ThumbnailCache {
  [pageId: string]: {
    thumbnail: string;
    timestamp: number;
    size: number;
    priority: 'high' | 'medium' | 'low';
  };
}

@Injectable({
  providedIn: 'root'
})
export class LazyLoadingService {
  private readonly DEFAULT_CONFIG: LazyLoadingConfig = {
    enabled: true,
    thumbnailQuality: 'medium',
    preloadBuffer: 5,
    unloadDistance: 20,
    maxCachedThumbnails: 50,
    virtualScrolling: true,
    chunkSize: 10
  };

  private config: LazyLoadingConfig = { ...this.DEFAULT_CONFIG };
  private thumbnailCache: ThumbnailCache = {};
  private loadingQueue = new Set<string>();
  private intersectionObserver: IntersectionObserver | null = null;

  private viewportSubject = new BehaviorSubject<ViewportInfo>({
    top: 0,
    bottom: 0,
    height: 0,
    itemHeight: 200,
    visibleStartIndex: 0,
    visibleEndIndex: 0,
    bufferSize: 5
  });

  private loadingStateSubject = new BehaviorSubject<{ [pageId: string]: boolean }>({});
  private memoryUsageSubject = new BehaviorSubject<number>(0);

  constructor() {
    this.initializeIntersectionObserver();
  }

  get viewport$(): Observable<ViewportInfo> {
    return this.viewportSubject.asObservable();
  }

  get loadingState$(): Observable<{ [pageId: string]: boolean }> {
    return this.loadingStateSubject.asObservable();
  }

  get memoryUsage$(): Observable<number> {
    return this.memoryUsageSubject.asObservable();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<LazyLoadingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Initialize viewport tracking
   */
  initializeViewport(container: HTMLElement, itemHeight: number): void {
    if (!this.config.enabled) return;

    const viewport = this.viewportSubject.value;
    viewport.itemHeight = itemHeight;
    viewport.height = container.clientHeight;
    viewport.bufferSize = this.config.preloadBuffer;

    this.viewportSubject.next(viewport);

    // Set up scroll listener with debouncing
    const scrollSubject = new Subject<void>();
    scrollSubject.pipe(
      debounceTime(100),
      distinctUntilChanged()
    ).subscribe(() => {
      this.updateViewport(container);
    });

    container.addEventListener('scroll', () => scrollSubject.next());

    // Set up resize listener
    const resizeObserver = new ResizeObserver(() => {
      this.updateViewport(container);
    });
    resizeObserver.observe(container);
  }

  /**
   * Update viewport information
   */
  private updateViewport(container: HTMLElement): void {
    const viewport = this.viewportSubject.value;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;

    viewport.top = scrollTop;
    viewport.bottom = scrollTop + containerHeight;
    viewport.height = containerHeight;

    // Calculate visible range
    viewport.visibleStartIndex = Math.floor(scrollTop / viewport.itemHeight);
    viewport.visibleEndIndex = Math.ceil(viewport.bottom / viewport.itemHeight);

    this.viewportSubject.next(viewport);
  }

  /**
   * Get visible page range with buffer
   */
  getVisiblePageRange(totalPages: number): { start: number; end: number } {
    const viewport = this.viewportSubject.value;

    const start = Math.max(0, viewport.visibleStartIndex - viewport.bufferSize);
    const end = Math.min(totalPages - 1, viewport.visibleEndIndex + viewport.bufferSize);

    return { start, end };
  }

  /**
   * Check if a page should be loaded
   */
  shouldLoadPage(pageIndex: number, totalPages: number): boolean {
    if (!this.config.enabled) return true;

    const { start, end } = this.getVisiblePageRange(totalPages);
    return pageIndex >= start && pageIndex <= end;
  }

  /**
   * Get cached thumbnail or placeholder
   */
  getThumbnail(pageId: string): string | null {
    const cached = this.thumbnailCache[pageId];
    if (cached) {
      // Update access timestamp
      cached.timestamp = Date.now();
      return cached.thumbnail;
    }
    return null;
  }

  /**
   * Cache thumbnail
   */
  cacheThumbnail(pageId: string, thumbnail: string, priority: 'high' | 'medium' | 'low' = 'medium'): void {
    // Estimate size (rough approximation)
    const estimatedSize = thumbnail.length * 0.75; // Base64 overhead

    this.thumbnailCache[pageId] = {
      thumbnail,
      timestamp: Date.now(),
      size: estimatedSize,
      priority
    };

    this.cleanupCache();
    this.updateMemoryUsage();
  }

  /**
   * Remove page from cache
   */
  removeCachedThumbnail(pageId: string): void {
    delete this.thumbnailCache[pageId];
    this.updateMemoryUsage();
  }

  /**
   * Get loading state for page
   */
  isPageLoading(pageId: string): boolean {
    return this.loadingQueue.has(pageId);
  }

  /**
   * Mark page as loading
   */
  setPageLoading(pageId: string, loading: boolean): void {
    if (loading) {
      this.loadingQueue.add(pageId);
    } else {
      this.loadingQueue.delete(pageId);
    }

    const currentState = this.loadingStateSubject.value;
    this.loadingStateSubject.next({
      ...currentState,
      [pageId]: loading
    });
  }

  /**
   * Get pages that need to be loaded
   */
  getPagesToLoad(document: PdfDocument): PdfPage[] {
    if (!this.config.enabled) return document.pages;

    const { start, end } = this.getVisiblePageRange(document.totalPages);

    return document.pages
      .slice(start, end + 1)
      .filter(page => {
        // Load if not cached and not currently loading
        return !this.getThumbnail(page.id) && !this.isPageLoading(page.id);
      });
  }

  /**
   * Get pages that should be unloaded
   */
  getPagesToUnload(document: PdfDocument): string[] {
    if (!this.config.enabled) return [];

    const { start, end } = this.getVisiblePageRange(document.totalPages);
    const unloadZoneStart = start - this.config.unloadDistance;
    const unloadZoneEnd = end + this.config.unloadDistance;

    return Object.keys(this.thumbnailCache).filter(pageId => {
      const page = document.pages.find(p => p.id === pageId);
      if (!page) return true; // Remove orphaned cache entries

      const pageIndex = page.pageNumber - 1;
      return pageIndex < unloadZoneStart || pageIndex > unloadZoneEnd;
    });
  }

  /**
   * Create intersection observer for visibility detection
   */
  private initializeIntersectionObserver(): void {
    if (typeof IntersectionObserver === 'undefined') return;

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const pageId = entry.target.getAttribute('data-page-id');
          if (!pageId) return;

          if (entry.isIntersecting) {
            // Page became visible - increase priority
            const cached = this.thumbnailCache[pageId];
            if (cached) {
              cached.priority = 'high';
              cached.timestamp = Date.now();
            }
          }
        });
      },
      {
        rootMargin: '100px', // Start loading 100px before page comes into view
        threshold: 0.1
      }
    );
  }

  /**
   * Observe page element for visibility
   */
  observePage(element: HTMLElement, pageId: string): void {
    if (this.intersectionObserver) {
      element.setAttribute('data-page-id', pageId);
      this.intersectionObserver.observe(element);
    }
  }

  /**
   * Stop observing page element
   */
  unobservePage(element: HTMLElement): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.unobserve(element);
    }
  }

  /**
   * Get virtual scroll data for large documents
   */
  getVirtualScrollData(document: PdfDocument, containerHeight: number): {
    totalHeight: number;
    visiblePages: PdfPage[];
    offsetY: number;
  } {
    if (!this.config.virtualScrolling || !this.config.enabled) {
      return {
        totalHeight: document.totalPages * this.viewportSubject.value.itemHeight,
        visiblePages: document.pages,
        offsetY: 0
      };
    }

    const itemHeight = this.viewportSubject.value.itemHeight;
    const { start, end } = this.getVisiblePageRange(document.totalPages);

    return {
      totalHeight: document.totalPages * itemHeight,
      visiblePages: document.pages.slice(start, end + 1),
      offsetY: start * itemHeight
    };
  }

  /**
   * Optimize document for large PDF viewing
   */
  optimizeForLargeDocument(document: PdfDocument): void {
    if (document.totalPages > 100) {
      // Automatically enable optimizations for large documents
      this.config.enabled = true;
      this.config.virtualScrolling = true;
      this.config.thumbnailQuality = 'medium';
      this.config.maxCachedThumbnails = Math.min(50, Math.floor(document.totalPages * 0.3));
    }

    if (document.totalPages > 500) {
      // More aggressive optimizations for very large documents
      this.config.thumbnailQuality = 'low';
      this.config.maxCachedThumbnails = 30;
      this.config.chunkSize = 5;
    }
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): {
    cachedPages: number;
    totalSizeBytes: number;
    averagePageSize: number;
    cacheHitRate: number;
  } {
    const cached = Object.values(this.thumbnailCache);
    const totalSize = cached.reduce((sum, item) => sum + item.size, 0);

    return {
      cachedPages: cached.length,
      totalSizeBytes: totalSize,
      averagePageSize: cached.length > 0 ? totalSize / cached.length : 0,
      cacheHitRate: 0 // Would need hit/miss tracking to calculate
    };
  }

  /**
   * Clean up old cache entries
   */
  private cleanupCache(): void {
    const cached = Object.entries(this.thumbnailCache);

    // Remove excess entries
    if (cached.length > this.config.maxCachedThumbnails) {
      // Sort by priority and timestamp (oldest low-priority first)
      const sorted = cached.sort((a, b) => {
        const [aId, aData] = a;
        const [bId, bData] = b;

        // Priority order: high > medium > low
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[aData.priority];
        const bPriority = priorityOrder[bData.priority];

        if (aPriority !== bPriority) {
          return aPriority - bPriority; // Lower priority first
        }

        return aData.timestamp - bData.timestamp; // Older first
      });

      // Remove excess entries
      const toRemove = sorted.slice(0, cached.length - this.config.maxCachedThumbnails);
      toRemove.forEach(([pageId]) => {
        delete this.thumbnailCache[pageId];
      });
    }
  }

  /**
   * Update memory usage observable
   */
  private updateMemoryUsage(): void {
    const totalSize = Object.values(this.thumbnailCache)
      .reduce((sum, item) => sum + item.size, 0);
    this.memoryUsageSubject.next(totalSize);
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.thumbnailCache = {};
    this.loadingQueue.clear();
    this.updateMemoryUsage();
  }

  /**
   * Cleanup on destroy
   */
  destroy(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    this.clearCache();
  }
}