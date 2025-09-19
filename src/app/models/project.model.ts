export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  color?: string;
  thumbnail?: string;
  documentCount: number;
  totalSize: number;
  isStarred: boolean;
  templateType?: ProjectTemplate;
}

export interface Document {
  id: string;
  projectId: string;
  name: string;
  type: DocumentType;
  originalFile?: File;
  processedFile?: File;
  createdAt: Date;
  updatedAt: Date;
  pageCount: number;
  fileSize: number;
  thumbnail?: string;
  ocrText?: string;
  metadata?: DocumentMetadata;
  status: DocumentStatus;
  isStarred: boolean;
}

export enum CaptureMethod {
  CAMERA = 'camera',
  FILE_UPLOAD = 'file_upload',
  GALLERY = 'gallery',
  CLIPBOARD = 'clipboard'
}

export interface Scan {
  id: string;
  projectId: string;
  documentId?: string;
  name: string;
  imageData: string; // Base64 or Blob URL
  originalImage: string; // Original capture
  processedImage?: string; // After enhancement/filters
  createdAt: Date;
  updatedAt: Date;
  captureMethod: CaptureMethod;
  enhancement: EnhancementSettings;
  ocrText?: string;
  metadata?: ScanMetadata;
  isProcessed: boolean;
}

export interface DocumentMetadata {
  author?: string;
  title?: string;
  subject?: string;
  keywords?: string[];
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
  pageSize?: PageSize;
  isPasswordProtected?: boolean;
  permissions?: DocumentPermissions;
}

export interface ScanMetadata {
  deviceInfo?: DeviceInfo;
  cameraSettings?: CameraSettings;
  location?: GeolocationCoordinates;
  quality?: number;
  resolution?: Resolution;
  colorSpace?: string;
  compression?: string;
}

export interface EnhancementSettings {
  filter: ImageFilter;
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
  autoEnhance: boolean;
  removeBackground: boolean;
  perspectiveCorrection: boolean;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  suggestedTags: string[];
  defaultEnhancements: EnhancementSettings;
}

// Enums and Types
export enum DocumentType {
  PDF = 'pdf',
  IMAGE = 'image',
  SCAN = 'scan',
  TEXT = 'text'
}

export enum DocumentStatus {
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  READY = 'ready',
  ERROR = 'error'
}

export enum ImageFilter {
  ORIGINAL = 'original',
  BLACK_WHITE = 'black_white',
  GRAYSCALE = 'grayscale',
  ENHANCED = 'enhanced',
  MAGIC_COLOR = 'magic_color'
}

export interface PageSize {
  width: number;
  height: number;
  unit: string;
}

export interface DocumentPermissions {
  canPrint: boolean;
  canModify: boolean;
  canCopy: boolean;
  canAddNotes: boolean;
}

export interface DeviceInfo {
  userAgent: string;
  platform: string;
  screenResolution: Resolution;
  pixelRatio: number;
}

export interface CameraSettings {
  facingMode: string;
  resolution: Resolution;
  zoom?: number;
  flash?: boolean;
  focusMode?: string;
}

export interface Resolution {
  width: number;
  height: number;
}

// Default templates
export const DEFAULT_PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'general',
    name: 'General Documents',
    description: 'For mixed document types and general use',
    icon: '📄',
    color: '#3B82F6',
    suggestedTags: ['document', 'general'],
    defaultEnhancements: {
      filter: ImageFilter.ENHANCED,
      brightness: 0,
      contrast: 0,
      saturation: 0,
      sharpness: 0,
      autoEnhance: true,
      removeBackground: false,
      perspectiveCorrection: true
    }
  },
  {
    id: 'business',
    name: 'Business Documents',
    description: 'Contracts, invoices, reports, and business papers',
    icon: '💼',
    color: '#059669',
    suggestedTags: ['business', 'official', 'contract'],
    defaultEnhancements: {
      filter: ImageFilter.BLACK_WHITE,
      brightness: 10,
      contrast: 15,
      saturation: 0,
      sharpness: 5,
      autoEnhance: true,
      removeBackground: true,
      perspectiveCorrection: true
    }
  },
  {
    id: 'receipts',
    name: 'Receipts & Bills',
    description: 'Shopping receipts, bills, and expense tracking',
    icon: '🧾',
    color: '#DC2626',
    suggestedTags: ['receipt', 'expense', 'bill'],
    defaultEnhancements: {
      filter: ImageFilter.ENHANCED,
      brightness: 20,
      contrast: 20,
      saturation: -10,
      sharpness: 10,
      autoEnhance: true,
      removeBackground: true,
      perspectiveCorrection: true
    }
  },
  {
    id: 'identity',
    name: 'ID Documents',
    description: 'Passports, licenses, certificates, and ID cards',
    icon: '🆔',
    color: '#7C3AED',
    suggestedTags: ['id', 'identity', 'official'],
    defaultEnhancements: {
      filter: ImageFilter.ORIGINAL,
      brightness: 5,
      contrast: 10,
      saturation: 0,
      sharpness: 5,
      autoEnhance: false,
      removeBackground: false,
      perspectiveCorrection: true
    }
  },
  {
    id: 'notes',
    name: 'Notes & Handwriting',
    description: 'Handwritten notes, sketches, and drawings',
    icon: '📝',
    color: '#EA580C',
    suggestedTags: ['notes', 'handwriting', 'personal'],
    defaultEnhancements: {
      filter: ImageFilter.BLACK_WHITE,
      brightness: 15,
      contrast: 25,
      saturation: 0,
      sharpness: 15,
      autoEnhance: true,
      removeBackground: true,
      perspectiveCorrection: true
    }
  }
];
