import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { PdfStateService, PdfState } from '../../services/pdf-state.service';
import { SnapshotService } from '../../services/snapshot.service';

@Component({
  selector: 'app-legacy-tools',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="min-h-screen flex flex-col bg-gray-50 text-gray-900" [class.dark]="darkMode">
      <!-- Header -->
      <header class="bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between items-center h-20">
            <!-- Logo -->
            <div class="flex items-center">
              <button
                routerLink="/projects"
                class="mr-4 p-2 text-white hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                title="Back to projects"
              >
                ← Back
              </button>
              <div class="flex-shrink-0 flex items-center">
                <div class="w-10 h-10 bg-white rounded-lg flex items-center justify-center mr-3 shadow-md">
                  <span class="text-2xl">📄</span>
                </div>
                <div>
                  <h1 class="text-2xl font-bold text-white">PDF Tools</h1>
                  <p class="text-xs text-blue-100">Legacy PDF Processing Tools</p>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center space-x-4">
              <!-- Statistics -->
              <div class="hidden md:block text-white text-sm">
                <div class="flex items-center space-x-4">
                  <span *ngIf="(state$ | async)?.files?.length" class="bg-white bg-opacity-20 px-3 py-1 rounded-full">
                    📁 {{(state$ | async)!.files.length}} Files
                  </span>
                  <span *ngIf="(state$ | async)?.selectedIndex !== null" class="bg-white bg-opacity-20 px-3 py-1 rounded-full">
                    ⚡ Ready to Process
                  </span>
                </div>
              </div>

              <!-- Undo/Redo Controls -->
              <div class="flex items-center space-x-2" *ngIf="state$ | async as state">
                <button
                  (click)="undo()"
                  [disabled]="!canUndo"
                  class="px-4 py-2 text-sm bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 backdrop-blur-sm"
                  title="Undo (Ctrl+Z)"
                >
                  <span class="flex items-center">
                    <span class="mr-2">↶</span> Undo
                    <span *ngIf="undoCount > 0" class="ml-1 text-xs bg-white bg-opacity-30 rounded-full px-2">{{undoCount}}</span>
                  </span>
                </button>
                <button
                  (click)="redo()"
                  [disabled]="!canRedo"
                  class="px-4 py-2 text-sm bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 backdrop-blur-sm"
                  title="Redo (Ctrl+Y)"
                >
                  <span class="flex items-center">
                    <span class="mr-2">↷</span> Redo
                  </span>
                </button>
              </div>

              <!-- Dark Mode Toggle -->
              <button
                (click)="toggleDarkMode()"
                class="p-3 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 focus:outline-none transition-all duration-200 backdrop-blur-sm"
                title="Toggle Dark Mode"
              >
                <span *ngIf="!darkMode">🌙</span>
                <span *ngIf="darkMode">☀️</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <!-- Main Content -->
      <main class="flex-1 overflow-hidden">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <!-- File Upload Area -->
          <div class="mb-12">
            <div class="text-center mb-8">
              <h1 class="text-4xl font-bold text-gray-900 mb-4">
                PDF Processing Tools
              </h1>
              <p class="text-xl text-gray-600 mb-6 max-w-3xl mx-auto">
                Convert, compress, merge, split, and edit your PDF files with our comprehensive suite of professional tools.
              </p>
            </div>

            <!-- File Upload -->
            <div class="relative">
              <div
                class="border-2 border-dashed border-blue-300 rounded-2xl p-12 text-center hover:border-blue-400 transition-all duration-300 bg-gradient-to-br from-blue-50 to-indigo-50"
                [class.border-blue-500]="isDragOver"
                [class.bg-blue-100]="isDragOver"
                (dragover)="onDragOver($event)"
                (dragleave)="onDragLeave($event)"
                (drop)="onDrop($event)"
              >
                <div class="space-y-6">
                  <div class="text-6xl animate-bounce">📄</div>
                  <div>
                    <p class="text-2xl font-semibold text-gray-900 mb-2">Upload Your PDF Files</p>
                    <p class="text-lg text-gray-600 mb-4">Drag and drop files here or click to browse</p>
                  </div>
                  <div class="flex justify-center">
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
                      class="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      <span class="flex items-center">
                        <span class="mr-2">📁</span> Select PDF Files
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Files List -->
          <div *ngIf="state$ | async as state" class="space-y-4">
            <div *ngIf="state.files.length > 0">
              <h2 class="text-lg font-medium text-gray-900 mb-4">Uploaded Files</h2>
              <div class="grid gap-4">
                <div
                  *ngFor="let file of state.files; let i = index"
                  class="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
                  [class.ring-2]="state.selectedIndex === i"
                  [class.ring-blue-500]="state.selectedIndex === i"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                      <div class="text-2xl">📄</div>
                      <div>
                        <h3 class="font-medium text-gray-900">{{file.name}}</h3>
                        <p class="text-sm text-gray-500">{{formatFileSize(file.size)}}</p>
                      </div>
                    </div>
                    <div class="flex items-center space-x-2">
                      <button
                        (click)="selectFile(i)"
                        class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        {{state.selectedIndex === i ? 'Selected' : 'Select'}}
                      </button>
                      <button
                        (click)="previewFile(file)"
                        class="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                      >
                        👁️ Preview
                      </button>
                      <button
                        (click)="downloadFile(file)"
                        class="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                      >
                        ⬇️ Download
                      </button>
                      <button
                        (click)="removeFile(i)"
                        class="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- PDF Tools Categories -->
          <div class="mt-8 space-y-6">
            <!-- Quick Actions for Selected File -->
            <div *ngIf="(state$ | async)?.selectedIndex !== null" class="mb-8">
              <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
                <h2 class="text-lg font-semibold text-blue-900 mb-4 flex items-center">
                  <span class="mr-2">⚡</span>Quick Actions for Selected File
                </h2>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    (click)="compressSelected()"
                    [disabled]="loading['compressing']"
                    class="p-3 bg-white border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors"
                  >
                    <div class="text-xl mb-1">🗜️</div>
                    <div class="text-xs font-medium">Compress</div>
                  </button>
                  <button
                    (click)="addWatermarkToSelected()"
                    [disabled]="loading['watermarking']"
                    class="p-3 bg-white border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors"
                  >
                    <div class="text-xl mb-1">💧</div>
                    <div class="text-xs font-medium">Watermark</div>
                  </button>
                  <button
                    (click)="rotatePdfPages()"
                    [disabled]="loading['rotating']"
                    class="p-3 bg-white border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors"
                  >
                    <div class="text-xl mb-1">🔄</div>
                    <div class="text-xs font-medium">Rotate</div>
                  </button>
                  <button
                    (click)="protectWithPassword()"
                    [disabled]="loading['protecting']"
                    class="p-3 bg-white border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors"
                  >
                    <div class="text-xl mb-1">🔒</div>
                    <div class="text-xs font-medium">Protect</div>
                  </button>
                </div>
              </div>
            </div>

            <!-- Convert from PDF -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <span class="mr-3 text-2xl">📄</span>Convert from PDF
              </h3>
              <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <button
                  (click)="convertPdfToWord()"
                  [disabled]="loading['converting']"
                  class="group p-4 bg-gradient-to-b from-blue-50 to-blue-100 border border-blue-200 rounded-xl hover:from-blue-100 hover:to-blue-200 transition-all duration-200 disabled:opacity-50"
                >
                  <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">📝</div>
                  <div class="text-sm font-medium text-blue-800">PDF to Word</div>
                </button>
                <button
                  (click)="convertPdfToExcel()"
                  [disabled]="loading['converting']"
                  class="group p-4 bg-gradient-to-b from-green-50 to-green-100 border border-green-200 rounded-xl hover:from-green-100 hover:to-green-200 transition-all duration-200 disabled:opacity-50"
                >
                  <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">📊</div>
                  <div class="text-sm font-medium text-green-800">PDF to Excel</div>
                </button>
                <button
                  (click)="convertPdfToPowerPoint()"
                  [disabled]="loading['converting']"
                  class="group p-4 bg-gradient-to-b from-orange-50 to-orange-100 border border-orange-200 rounded-xl hover:from-orange-100 hover:to-orange-200 transition-all duration-200 disabled:opacity-50"
                >
                  <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">📈</div>
                  <div class="text-sm font-medium text-orange-800">PDF to PPT</div>
                </button>
                <button
                  (click)="convertPdfToImages()"
                  [disabled]="loading['converting']"
                  class="group p-4 bg-gradient-to-b from-purple-50 to-purple-100 border border-purple-200 rounded-xl hover:from-purple-100 hover:to-purple-200 transition-all duration-200 disabled:opacity-50"
                >
                  <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">🖼️</div>
                  <div class="text-sm font-medium text-purple-800">PDF to Images</div>
                </button>
                <button
                  (click)="extractTextFromPdf()"
                  [disabled]="loading['extracting']"
                  class="group p-4 bg-gradient-to-b from-gray-50 to-gray-100 border border-gray-200 rounded-xl hover:from-gray-100 hover:to-gray-200 transition-all duration-200 disabled:opacity-50"
                >
                  <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">📝</div>
                  <div class="text-sm font-medium text-gray-800">Extract Text</div>
                </button>
                <button
                  (click)="extractImagesFromPdf()"
                  [disabled]="loading['extracting']"
                  class="group p-4 bg-gradient-to-b from-pink-50 to-pink-100 border border-pink-200 rounded-xl hover:from-pink-100 hover:to-pink-200 transition-all duration-200 disabled:opacity-50"
                >
                  <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">🖼️</div>
                  <div class="text-sm font-medium text-pink-800">Extract Images</div>
                </button>
              </div>
            </div>

            <!-- Additional tool categories would continue here... -->
            <!-- For brevity, I'm including just the main sections -->

            <!-- PDF Tools -->
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <span class="mr-3 text-2xl">🛠️</span>PDF Tools
              </h3>
              <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <button
                  (click)="compressSelected()"
                  [disabled]="loading['compressing']"
                  class="group p-4 bg-gradient-to-b from-green-50 to-green-100 border border-green-200 rounded-xl hover:from-green-100 hover:to-green-200 transition-all duration-200 disabled:opacity-50"
                >
                  <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">🗜️</div>
                  <div class="text-sm font-medium text-green-800">Compress</div>
                </button>
                <button
                  (click)="mergeAllFiles()"
                  [disabled]="loading['merging'] || (state$ | async)!.files.length < 2"
                  class="group p-4 bg-gradient-to-b from-blue-50 to-blue-100 border border-blue-200 rounded-xl hover:from-blue-100 hover:to-blue-200 transition-all duration-200 disabled:opacity-50"
                >
                  <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">📎</div>
                  <div class="text-sm font-medium text-blue-800">Merge PDFs</div>
                </button>
                <button
                  (click)="clearAllFiles()"
                  class="group p-4 bg-gradient-to-b from-red-50 to-red-100 border border-red-200 rounded-xl hover:from-red-100 hover:to-red-200 transition-all duration-200"
                >
                  <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">🗑️</div>
                  <div class="text-sm font-medium text-red-800">Clear All</div>
                </button>
              </div>
            </div>
          </div>

          <!-- Error Display -->
          <div *ngIf="(state$ | async)?.error" class="mt-4">
            <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {{(state$ | async)?.error}}
            </div>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .dark {
      background-color: #111827;
      color: #f9fafb;
    }
  `]
})
export class LegacyToolsComponent implements OnInit, OnDestroy {
  title = 'pdf-master-legacy-tools';
  darkMode = false;

  state$: Observable<PdfState>;
  canUndo = false;
  canRedo = false;
  undoCount = 0;
  loading: { [key: string]: boolean } = {};
  isDragOver = false;

  private destroy$ = new Subject<void>();

  constructor(
    private pdfStateService: PdfStateService,
    private snapshotService: SnapshotService
  ) {
    this.state$ = this.pdfStateService.state$;
  }

  ngOnInit(): void {
    // Subscribe to snapshot changes
    this.snapshotService.canUndo$
      .pipe(takeUntil(this.destroy$))
      .subscribe(canUndo => this.canUndo = canUndo);

    this.snapshotService.canRedo$
      .pipe(takeUntil(this.destroy$))
      .subscribe(canRedo => this.canRedo = canRedo);

    this.snapshotService.history$
      .pipe(takeUntil(this.destroy$))
      .subscribe(history => this.undoCount = history.length);

    // Subscribe to loading states
    this.pdfStateService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => this.loading = loading);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleDarkMode(): void {
    this.darkMode = !this.darkMode;
  }

  onFileSelect(event: any): void {
    const files = Array.from(event.target.files) as File[];
    if (files.length > 0) {
      this.pdfStateService.addFiles(files);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    const files = Array.from(event.dataTransfer?.files || []) as File[];
    const pdfFiles = files.filter(file => file.type === 'application/pdf');

    if (pdfFiles.length > 0) {
      this.pdfStateService.addFiles(pdfFiles);
    }
  }

  selectFile(index: number): void {
    this.pdfStateService.setSelectedIndex(index);
  }

  removeFile(index: number): void {
    this.pdfStateService.removeFile(index);
  }

  clearAllFiles(): void {
    if (confirm('Are you sure you want to clear all files?')) {
      this.pdfStateService.clearFiles();
    }
  }

  undo(): void {
    this.pdfStateService.undo();
  }

  redo(): void {
    this.pdfStateService.redo();
  }

  // PDF processing methods (stubs - implement actual functionality)
  async compressSelected(): Promise<void> {
    const state = this.pdfStateService.currentState;
    if (state.selectedIndex !== null) {
      const file = state.files[state.selectedIndex];
      try {
        await this.pdfStateService.compressPdf(file, { jpegQuality: 0.7 });
      } catch (error) {
        this.pdfStateService.setError('Failed to compress PDF');
      }
    }
  }

  async addWatermarkToSelected(): Promise<void> {
    const watermarkText = prompt('Enter watermark text:');
    if (!watermarkText) return;

    const state = this.pdfStateService.currentState;
    if (state.selectedIndex !== null) {
      const file = state.files[state.selectedIndex];
      try {
        await this.pdfStateService.addWatermark(file, watermarkText, {
          fontSize: 50,
          opacity: 0.3,
          color: { r: 0.5, g: 0.5, b: 0.5 }
        });
      } catch (error) {
        this.pdfStateService.setError('Failed to add watermark');
      }
    }
  }

  async mergeAllFiles(): Promise<void> {
    const state = this.pdfStateService.currentState;
    if (state.files.length >= 2) {
      try {
        const mergedBlob = await this.pdfStateService.mergePdfs(state.files);
        this.downloadBlob(mergedBlob, 'merged.pdf');
      } catch (error) {
        this.pdfStateService.setError('Failed to merge PDFs');
      }
    }
  }

  previewFile(file: File): void {
    // Implement preview functionality
    console.log('Preview file:', file.name);
  }

  downloadFile(file: File): void {
    this.downloadBlob(file, file.name);
  }

  // Stub methods for all the PDF tools
  convertPdfToWord(): void { this.showFeatureNotification('PDF to Word conversion - Feature coming soon!'); }
  convertPdfToExcel(): void { this.showFeatureNotification('PDF to Excel conversion - Feature coming soon!'); }
  convertPdfToPowerPoint(): void { this.showFeatureNotification('PDF to PowerPoint conversion - Feature coming soon!'); }
  convertPdfToImages(): void { this.showFeatureNotification('PDF to Images conversion - Feature coming soon!'); }
  extractTextFromPdf(): void { this.showFeatureNotification('Text extraction - Feature coming soon!'); }
  extractImagesFromPdf(): void { this.showFeatureNotification('Image extraction - Feature coming soon!'); }
  rotatePdfPages(): void { this.showFeatureNotification('Page rotation - Feature coming soon!'); }
  protectWithPassword(): void { this.showFeatureNotification('Password protection - Feature coming soon!'); }

  formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
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

  private showFeatureNotification(message: string): void {
    this.pdfStateService.setError(message);
    setTimeout(() => {
      this.pdfStateService.setError(null);
    }, 3000);
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardShortcuts(event: KeyboardEvent): void {
    // Ctrl+Z for undo
    if (event.ctrlKey && event.key === 'z' && !event.shiftKey) {
      event.preventDefault();
      if (this.canUndo) {
        this.undo();
      }
    }
    // Ctrl+Y or Ctrl+Shift+Z for redo
    if ((event.ctrlKey && event.key === 'y') || (event.ctrlKey && event.shiftKey && event.key === 'Z')) {
      event.preventDefault();
      if (this.canRedo) {
        this.redo();
      }
    }
  }
}