export interface PdfDocument {
  id: string;
  projectId: string;
  name: string;
  pages: PdfPage[];
  originalFile: File;
  currentVersion: Uint8Array;
  metadata: PdfMetadata;
  history: OperationSnapshot[];
  totalPages: number;
  fileSize: number;
  isProcessing: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PdfPage {
  id: string;
  documentId: string;
  pageNumber: number; // 1-based
  thumbnail: string; // Base64 image data URL
  highResThumbnail?: string; // Higher resolution for editing
  isSelected: boolean;
  isVisible: boolean; // For lazy loading
  modifications: PageModification[];
  originalDimensions: PageDimensions;
  currentDimensions: PageDimensions;
  rotation: number; // 0, 90, 180, 270
  annotations: PageAnnotation[];
}

export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
  encrypted: boolean;
  permissions: PdfPermissions;
  pdfVersion: string;
  pageLayout?: string;
  pageMode?: string;
}

export interface PageDimensions {
  width: number;
  height: number;
  unit: 'pt' | 'px' | 'mm' | 'in';
}

export interface PdfPermissions {
  printing: boolean;
  modifying: boolean;
  copying: boolean;
  annotating: boolean;
  fillingForms: boolean;
  extracting: boolean;
  assembling: boolean;
  printingHighRes: boolean;
}

export interface OperationSnapshot {
  id: string;
  operationType: OperationType;
  operationName: string;
  description: string;
  timestamp: Date;
  affectedPages: string[]; // Page IDs
  thumbnails: { [pageId: string]: string }; // Small preview thumbnails
  documentState?: Uint8Array; // PDF state (stored selectively for memory)
  canUndo: boolean;
  canRedo: boolean;
  metadata: {
    pageCount: number;
    totalSize: number;
    operationDuration?: number;
  };
}

export interface PageModification {
  id: string;
  type: ModificationType;
  data: ModificationData;
  timestamp: Date;
  isActive: boolean;
}

export interface PageAnnotation {
  id: string;
  type: AnnotationType;
  position: AnnotationPosition;
  style: AnnotationStyle;
  content?: string;
  timestamp: Date;
  author?: string;
}

export interface AnnotationPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

export interface AnnotationStyle {
  color: string;
  fillColor?: string;
  strokeWidth: number;
  opacity: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
}

// Type unions and enums
export type OperationType =
  | 'init'
  | 'merge'
  | 'split'
  | 'compress'
  | 'rotate'
  | 'reorder'
  | 'delete'
  | 'extract'
  | 'watermark'
  | 'annotate'
  | 'crop'
  | 'insert'
  | 'convert';

export type ModificationType =
  | 'rotate'
  | 'crop'
  | 'watermark'
  | 'overlay'
  | 'resize'
  | 'filter';

export type AnnotationType =
  | 'text'
  | 'highlight'
  | 'rectangle'
  | 'circle'
  | 'line'
  | 'arrow'
  | 'freehand'
  | 'stamp'
  | 'image';

export interface ModificationData {
  // Rotation
  angle?: number;

  // Crop
  cropBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  // Watermark
  watermark?: {
    text?: string;
    image?: string;
    position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    opacity: number;
    fontSize?: number;
    color?: string;
    rotation?: number;
  };

  // Overlay
  overlay?: {
    image: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    opacity: number;
  };

  // Resize
  newDimensions?: PageDimensions;

  // Filter
  filter?: {
    type: 'grayscale' | 'sepia' | 'invert' | 'brightness' | 'contrast';
    value?: number;
  };
}

// Operation configurations
export interface MergeConfig {
  documentIds: string[];
  outputName: string;
  pageRanges?: { [documentId: string]: number[] };
  bookmarks: boolean;
  metadata: boolean;
}

export interface SplitConfig {
  method: 'pages' | 'range' | 'size';
  pages?: number[]; // Page numbers to split at
  ranges?: { start: number; end: number; name?: string }[];
  maxSize?: number; // In bytes
  outputPrefix: string;
}

export interface CompressConfig {
  quality: 'low' | 'medium' | 'high' | 'custom';
  customQuality?: number; // 0-100
  optimizeImages: boolean;
  removeMetadata: boolean;
  removeBookmarks: boolean;
  removeComments: boolean;
}

export interface ExportConfig {
  format: 'pdf' | 'png' | 'jpg' | 'zip';
  pages?: number[]; // Empty means all pages
  quality?: number; // For images
  dpi?: number; // For images
  backgroundColor?: string; // For images
  includeAnnotations: boolean;
  fileName?: string;
}

// Utility functions
export function createPdfPage(
  id: string,
  documentId: string,
  pageNumber: number,
  dimensions: PageDimensions
): PdfPage {
  return {
    id,
    documentId,
    pageNumber,
    thumbnail: '',
    isSelected: false,
    isVisible: false,
    modifications: [],
    originalDimensions: dimensions,
    currentDimensions: { ...dimensions },
    rotation: 0,
    annotations: []
  };
}

export function createOperationSnapshot(
  operationType: OperationType,
  operationName: string,
  description: string,
  affectedPages: string[] = []
): OperationSnapshot {
  return {
    id: `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    operationType,
    operationName,
    description,
    timestamp: new Date(),
    affectedPages,
    thumbnails: {},
    canUndo: true,
    canRedo: false,
    metadata: {
      pageCount: affectedPages.length,
      totalSize: 0
    }
  };
}

export function getPageDisplaySize(
  page: PdfPage,
  containerWidth: number,
  maxHeight: number = 300
): { width: number; height: number } {
  const aspectRatio = page.currentDimensions.width / page.currentDimensions.height;

  let width = containerWidth;
  let height = width / aspectRatio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }

  return { width, height };
}