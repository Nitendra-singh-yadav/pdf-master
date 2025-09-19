import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { Project, Document as ProjectDocument, Scan } from '../../models/project.model';
import { ProjectService } from '../../services/project.service';
import { PdfPreviewModalComponent } from '../pdf-preview-modal.component';

@Component({
  selector: 'app-project-view',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PdfPreviewModalComponent],
  template: `
    <div class="min-h-screen bg-gray-50" [class.dark]="isDarkMode" *ngIf="project">
      <!-- Header -->
      <header class="bg-white border-b border-gray-200">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <!-- Mobile Layout -->
          <div class="md:hidden">
            <div class="flex items-center justify-between h-14">
              <div class="flex items-center space-x-3 flex-1 min-w-0">
                <button
                  routerLink="/projects"
                  class="p-1 text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0"
                  title="Back to projects"
                >
                  ←
                </button>
                <div class="flex items-center min-w-0 flex-1">
                  <div
                    class="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold mr-2 flex-shrink-0"
                    [style.background-color]="project.color || '#3B82F6'"
                  >
                    <span class="text-sm">{{project.templateType?.icon || '📄'}}</span>
                  </div>
                  <div class="min-w-0 flex-1">
                    <h1 class="text-base font-bold text-gray-900 truncate">{{project.name}}</h1>
                    <p class="text-xs text-gray-500 truncate">{{project.documentCount}} docs • {{formatSize(project.totalSize)}}</p>
                  </div>
                </div>
              </div>
              <button
                (click)="showMobileActions = !showMobileActions"
                class="p-2 text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0"
                title="Actions"
              >
                ⋮
              </button>
            </div>

            <!-- Mobile Actions Dropdown -->
            <div *ngIf="showMobileActions" class="border-t border-gray-200 bg-gray-50 p-3">
              <div class="grid grid-cols-2 gap-2">
                <button
                  (click)="startScanning(); showMobileActions = false"
                  class="p-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <span class="flex items-center justify-center">
                    <span class="mr-1">📷</span> Scan
                  </span>
                </button>
                <button
                  (click)="fileInput.click(); showMobileActions = false"
                  class="p-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors text-sm"
                >
                  <span class="flex items-center justify-center">
                    <span class="mr-1">📄</span> Upload
                  </span>
                </button>
              </div>
              <button
                (click)="showProjectSettings = true; showMobileActions = false"
                class="w-full mt-2 p-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                ⚙️ Project Settings
              </button>
            </div>
          </div>

          <!-- Desktop Layout -->
          <div class="hidden md:flex items-center justify-between h-16">
            <div class="flex items-center space-x-4">
              <button
                routerLink="/projects"
                class="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                title="Back to projects"
              >
                ← Back
              </button>
              <div class="flex items-center">
                <div
                  class="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold mr-3"
                  [style.background-color]="project.color || '#3B82F6'"
                >
                  {{project.templateType?.icon || '📄'}}
                </div>
                <div>
                  <h1 class="text-xl font-bold text-gray-900">{{project.name}}</h1>
                  <p class="text-sm text-gray-500">{{project.documentCount}} documents • {{formatSize(project.totalSize)}}</p>
                </div>
              </div>
            </div>

            <div class="flex items-center space-x-3">
              <!-- Scan Document Button -->
              <button
                (click)="startScanning()"
                class="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <span class="flex items-center">
                  <span class="mr-2">📷</span> Scan Document
                </span>
              </button>

              <!-- Upload Files Button -->
              <button
                (click)="fileInput.click()"
                class="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                <span class="flex items-center">
                  <span class="mr-2">📄</span> Upload Files
                </span>
              </button>

              <!-- Project Actions -->
              <button
                (click)="showProjectSettings = true"
                class="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                title="Project settings"
              >
                ⚙️
              </button>
            </div>
          </div>

          <!-- Hidden file input -->
          <input
            #fileInput
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            (change)="onFileSelect($event)"
            class="hidden"
          >
        </div>
      </header>

      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        <!-- Quick Actions -->
        <div class="mb-6 md:mb-8 hidden md:block">
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 class="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                (click)="startScanning()"
                class="p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors group"
              >
                <div class="text-3xl mb-2 group-hover:scale-110 transition-transform">📷</div>
                <div class="text-sm font-medium text-blue-900">Scan Document</div>
              </button>

              <button
                (click)="fileInput.click()"
                class="p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors group"
              >
                <div class="text-3xl mb-2 group-hover:scale-110 transition-transform">📄</div>
                <div class="text-sm font-medium text-green-900">Upload Files</div>
              </button>

              <button
                (click)="mergeDocuments()"
                [disabled]="documents.length < 2"
                class="p-4 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors group disabled:opacity-50"
              >
                <div class="text-3xl mb-2 group-hover:scale-110 transition-transform">📎</div>
                <div class="text-sm font-medium text-purple-900">Merge PDFs</div>
              </button>

              <button
                (click)="exportProject()"
                [disabled]="documents.length === 0"
                class="p-4 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors group disabled:opacity-50"
              >
                <div class="text-3xl mb-2 group-hover:scale-110 transition-transform">📦</div>
                <div class="text-sm font-medium text-orange-900">Export All</div>
              </button>
            </div>
          </div>
        </div>

        <!-- Documents and Scans Tabs -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200">
          <!-- Tab Navigation -->
          <div class="border-b border-gray-200">
            <nav class="flex space-x-4 md:space-x-8 px-4 md:px-6" aria-label="Tabs">
              <button
                (click)="activeTab = 'documents'"
                [class.border-blue-500]="activeTab === 'documents'"
                [class.text-blue-600]="activeTab === 'documents'"
                [class.border-transparent]="activeTab !== 'documents'"
                [class.text-gray-500]="activeTab !== 'documents'"
                class="py-3 md:py-4 px-1 border-b-2 font-medium text-sm hover:text-gray-700 hover:border-gray-300 transition-colors"
              >
                <span class="hidden sm:inline">Documents ({{documents.length}})</span>
                <span class="sm:hidden">Docs ({{documents.length}})</span>
              </button>
              <button
                (click)="activeTab = 'scans'"
                [class.border-blue-500]="activeTab === 'scans'"
                [class.text-blue-600]="activeTab === 'scans'"
                [class.border-transparent]="activeTab !== 'scans'"
                [class.text-gray-500]="activeTab !== 'scans'"
                class="py-3 md:py-4 px-1 border-b-2 font-medium text-sm hover:text-gray-700 hover:border-gray-300 transition-colors"
              >
                <span class="hidden sm:inline">Scans ({{scans.length}})</span>
                <span class="sm:hidden">Scans ({{scans.length}})</span>
              </button>
            </nav>
          </div>

          <!-- Documents Tab Content -->
          <div *ngIf="activeTab === 'documents'" class="p-4 md:p-6">
            <div *ngIf="documents.length === 0" class="text-center py-12">
              <div class="text-6xl mb-4">📄</div>
              <h3 class="text-lg font-medium text-gray-900 mb-2">No documents yet</h3>
              <p class="text-gray-500 mb-6">Upload or scan documents to get started</p>
              <div class="flex justify-center space-x-4">
                <button
                  (click)="startScanning()"
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  📷 Scan Document
                </button>
                <button
                  (click)="fileInput.click()"
                  class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  📄 Upload Files
                </button>
              </div>
            </div>

            <div *ngIf="documents.length > 0" class="grid gap-3 md:gap-4">
              <div
                *ngFor="let doc of documents"
                class="flex items-center p-3 md:p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
              >
                <div class="flex-shrink-0">
                  <div class="w-10 h-10 md:w-12 md:h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <span class="text-lg md:text-2xl">📄</span>
                  </div>
                </div>
                <div class="ml-3 md:ml-4 flex-1 min-w-0">
                  <h3 class="text-base md:text-lg font-medium text-gray-900 truncate">{{doc.name}}</h3>
                  <p class="text-xs md:text-sm text-gray-500 truncate">
                    {{formatDate(doc.createdAt)}} • {{formatSize(doc.fileSize)}} • {{doc.pageCount}} pages
                  </p>
                </div>
                <div class="flex items-center space-x-1 md:space-x-2 flex-shrink-0">
                  <button
                    (click)="previewDocument(doc)"
                    class="px-2 md:px-3 py-1 text-xs md:text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                  >
                    <span class="hidden sm:inline">👁️ Preview</span>
                    <span class="sm:hidden">👁️</span>
                  </button>
                  <button
                    (click)="downloadDocument(doc)"
                    class="px-2 md:px-3 py-1 text-xs md:text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                  >
                    <span class="hidden sm:inline">⬇️ Download</span>
                    <span class="sm:hidden">⬇️</span>
                  </button>
                  <button
                    (click)="showDocumentMenu(doc, $event)"
                    class="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    ⋮
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Scans Tab Content -->
          <div *ngIf="activeTab === 'scans'" class="p-4 md:p-6">
            <div *ngIf="scans.length === 0" class="text-center py-12">
              <div class="text-6xl mb-4">📷</div>
              <h3 class="text-lg font-medium text-gray-900 mb-2">No scans yet</h3>
              <p class="text-gray-500 mb-6">Use your camera to scan documents</p>
              <button
                (click)="startScanning()"
                class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                📷 Start Scanning
              </button>
            </div>

            <div *ngIf="scans.length > 0" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
              <div
                *ngFor="let scan of scans"
                class="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                (click)="previewScan(scan)"
              >
                <div class="aspect-w-3 aspect-h-4">
                  <img
                    [src]="scan.processedImage || scan.imageData"
                    [alt]="scan.name"
                    class="w-full h-24 md:h-32 object-cover"
                  >
                </div>
                <div class="p-2 md:p-3">
                  <h3 class="text-xs md:text-sm font-medium text-gray-900 truncate">{{scan.name}}</h3>
                  <p class="text-xs text-gray-500">{{formatDate(scan.createdAt)}}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <!-- Project Settings Modal -->
      <div
        *ngIf="showProjectSettings"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        (click)="closeProjectSettings()"
      >
        <div
          class="bg-white rounded-lg p-4 md:p-6 max-w-md w-full mx-4"
          (click)="$event.stopPropagation()"
        >
          <h2 class="text-lg md:text-xl font-bold mb-4">Project Settings</h2>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Project Name</label>
              <input
                type="text"
                [(ngModel)]="editingProject.name"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                [(ngModel)]="editingProject.description"
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              ></textarea>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-4 border-t space-y-3 sm:space-y-0">
              <button
                (click)="deleteProject()"
                class="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors order-last sm:order-first"
              >
                Delete Project
              </button>
              <div class="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                <button
                  (click)="closeProjectSettings()"
                  class="w-full sm:w-auto px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  (click)="saveProjectSettings()"
                  class="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
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
    </div>
  `,
  styles: [`
    .aspect-w-3 {
      position: relative;
      padding-bottom: 133.333333%;
    }
    .aspect-w-3 > img {
      position: absolute;
      height: 100%;
      width: 100%;
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
    }
  `]
})
export class ProjectViewComponent implements OnInit, OnDestroy {
  project: Project | null = null;
  documents: ProjectDocument[] = [];
  scans: Scan[] = [];

  activeTab: 'documents' | 'scans' = 'documents';
  isDarkMode = false;
  showProjectSettings = false;
  showPreviewModal = false;
  previewFile: File | null = null;
  showMobileActions = false;

  editingProject = {
    name: '',
    description: ''
  };

  private destroy$ = new Subject<void>();
  private projectId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectService: ProjectService
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.projectId = params['id'];
      if (this.projectId) {
        this.loadProject();
      }
    });

    // Subscribe to project data
    this.projectService.currentProject$
      .pipe(takeUntil(this.destroy$))
      .subscribe(project => {
        this.project = project;
        if (project) {
          this.editingProject = {
            name: project.name,
            description: project.description || ''
          };
        }
      });

    this.projectService.documents$
      .pipe(takeUntil(this.destroy$))
      .subscribe(documents => this.documents = documents);

    this.projectService.scans$
      .pipe(takeUntil(this.destroy$))
      .subscribe(scans => this.scans = scans);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadProject(): Promise<void> {
    if (this.projectId) {
      await this.projectService.setCurrentProject(this.projectId);
    }
  }

  async onFileSelect(event: any): Promise<void> {
    const files = Array.from(event.target.files) as File[];
    if (files.length > 0 && this.projectId) {
      for (const file of files) {
        try {
          await this.projectService.addDocument(this.projectId, file);
        } catch (error) {
          console.error('Failed to add document:', error);
        }
      }
    }
    // Clear the input
    event.target.value = '';
  }

  startScanning(): void {
    // Navigate to scanner view - will implement with routing
    console.log('Starting document scanner');
  }

  async previewDocument(doc: ProjectDocument): Promise<void> {
    try {
      console.log('Previewing document:', doc.name);

      // Check if we have the file to preview
      const file = doc.processedFile || doc.originalFile;
      if (file && file.type === 'application/pdf') {
        // Open the full-screen PDF preview modal
        this.previewFile = file;
        this.showPreviewModal = true;
      } else if (file) {
        // For non-PDF files, download instead
        this.downloadDocument(doc);
      } else {
        alert('Document file not available for preview');
      }
    } catch (error) {
      console.error('Failed to preview document:', error);
      alert('Failed to open document preview');
    }
  }

  downloadDocument(doc: ProjectDocument): void {
    try {
      console.log('Downloading document:', doc.name);

      const file = doc.processedFile || doc.originalFile;
      if (file) {
        // Create blob and download link
        const url = URL.createObjectURL(file);

        const a = globalThis.document.createElement('a');
        a.href = url;
        a.download = doc.name;
        globalThis.document.body.appendChild(a);
        a.click();
        globalThis.document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        alert('Document file not available for download');
      }
    } catch (error) {
      console.error('Failed to download document:', error);
      alert('Failed to download document');
    }
  }

  showDocumentMenu(document: ProjectDocument, event: Event): void {
    event.stopPropagation();
    console.log('Show menu for document:', document.name);
  }

  previewScan(scan: Scan): void {
    console.log('Previewing scan:', scan.name);
  }

  mergeDocuments(): void {
    console.log('Merging documents');
  }

  exportProject(): void {
    console.log('Exporting project');
  }

  async saveProjectSettings(): Promise<void> {
    if (this.project && this.projectId) {
      try {
        await this.projectService.updateProject(this.projectId, {
          name: this.editingProject.name,
          description: this.editingProject.description
        });
        this.closeProjectSettings();
      } catch (error) {
        console.error('Failed to update project:', error);
      }
    }
  }

  async deleteProject(): Promise<void> {
    if (this.project && this.projectId) {
      const confirmed = confirm(`Are you sure you want to delete "${this.project.name}"? This action cannot be undone.`);
      if (confirmed) {
        try {
          await this.projectService.deleteProject(this.projectId);
          // Navigate back to projects list
          window.location.href = '/projects';
        } catch (error) {
          console.error('Failed to delete project:', error);
        }
      }
    }
  }

  closeProjectSettings(): void {
    this.showProjectSettings = false;
  }

  formatDate(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;

    return date.toLocaleDateString();
  }

  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // PDF Preview Modal methods
  closePreview(): void {
    this.showPreviewModal = false;
    this.previewFile = null;
  }

  onPreviewError(error: string): void {
    console.error('Preview error:', error);
    alert(`Preview error: ${error}`);
    this.closePreview();
  }
}