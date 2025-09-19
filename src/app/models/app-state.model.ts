import { Project, Document, Scan } from './project.model';

export interface AppState {
  // Project-related state
  projects: Project[];
  currentProject: Project | null;
  selectedProjectId: string | null;

  // Document-related state (within current project)
  documents: Document[];
  selectedDocument: Document | null;
  selectedDocumentId: string | null;

  // Scan-related state
  scans: Scan[];
  selectedScan: Scan | null;
  selectedScanId: string | null;

  // UI state
  currentView: AppView;
  previousView: AppView | null;
  sidebarOpen: boolean;
  isDarkMode: boolean;

  // Processing state
  isLoading: boolean;
  loadingOperations: { [key: string]: boolean };

  // Error handling
  error: string | null;
  notifications: Notification[];

  // Legacy PDF state (for backward compatibility)
  legacyPdfState?: LegacyPdfState;

  // Navigation state
  breadcrumbs: BreadcrumbItem[];

  // Search and filters
  searchQuery: string;
  filters: FilterState;

  // User preferences
  preferences: UserPreferences;
}

export interface LegacyPdfState {
  files: File[];
  selectedIndex: number | null;
  currentPage: number;
  numPages: number;
  selectedPages: number[];
  zoom: number;
  reorderedPages: any[] | null;
  isReordered: boolean;
  lastOperation: string | null;
  operationTimestamp: number | null;
}

export interface BreadcrumbItem {
  label: string;
  route?: string;
  icon?: string;
  isActive?: boolean;
}

export interface FilterState {
  projectTags: string[];
  documentTypes: string[];
  dateRange: DateRange | null;
  sizeRange: SizeRange | null;
  starred: boolean | null;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface SizeRange {
  minSize: number; // in bytes
  maxSize: number; // in bytes
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: Date;
  isRead: boolean;
  autoHide: boolean;
  duration?: number; // in ms
  action?: NotificationAction;
}

export interface NotificationAction {
  label: string;
  handler: () => void;
}

export interface UserPreferences {
  defaultProjectTemplate: string;
  autoEnhanceScans: boolean;
  defaultImageFilter: string;
  ocrLanguages: string[];
  cloudStorageEnabled: boolean;
  cloudProvider: string | null;
  notificationsEnabled: boolean;
  autoBackup: boolean;
  maxFileSize: number; // in MB
  compressionQuality: number; // 0-100
  theme: 'light' | 'dark' | 'auto';
  language: string;
}

export enum AppView {
  DASHBOARD = 'dashboard',
  PROJECT_LIST = 'project_list',
  PROJECT_VIEW = 'project_view',
  DOCUMENT_VIEWER = 'document_viewer',
  SCANNER = 'scanner',
  OCR_EDITOR = 'ocr_editor',
  SETTINGS = 'settings',
  LEGACY_TOOLS = 'legacy_tools' // For existing PDF tools
}

export enum NotificationType {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

// Initial state factory
export function createInitialAppState(): AppState {
  return {
    projects: [],
    currentProject: null,
    selectedProjectId: null,
    documents: [],
    selectedDocument: null,
    selectedDocumentId: null,
    scans: [],
    selectedScan: null,
    selectedScanId: null,
    currentView: AppView.DASHBOARD,
    previousView: null,
    sidebarOpen: true,
    isDarkMode: false,
    isLoading: false,
    loadingOperations: {},
    error: null,
    notifications: [],
    breadcrumbs: [
      { label: 'Dashboard', route: '/dashboard', icon: '🏠', isActive: true }
    ],
    searchQuery: '',
    filters: {
      projectTags: [],
      documentTypes: [],
      dateRange: null,
      sizeRange: null,
      starred: null
    },
    preferences: {
      defaultProjectTemplate: 'general',
      autoEnhanceScans: true,
      defaultImageFilter: 'enhanced',
      ocrLanguages: ['eng'],
      cloudStorageEnabled: false,
      cloudProvider: null,
      notificationsEnabled: true,
      autoBackup: false,
      maxFileSize: 50,
      compressionQuality: 80,
      theme: 'auto',
      language: 'en'
    }
  };
}

// State update helpers
export interface StateUpdate<T = any> {
  operation: string;
  timestamp: number;
  changes: Partial<T>;
  undoData?: any;
}