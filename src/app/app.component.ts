import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router } from '@angular/router';
import { ProjectService } from './services/project.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `
    <div class="min-h-screen bg-gray-50">
      <!-- Navigation Header -->
      <header class="bg-white shadow-sm border-b border-gray-200" *ngIf="showNavigation">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between items-center h-16">
            <!-- Logo and Navigation -->
            <div class="flex items-center space-x-8">
              <div class="flex items-center">
                <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                  <span class="text-white text-lg">📄</span>
                </div>
                <div>
                  <h1 class="text-xl font-bold text-gray-900">PDF Master</h1>
                  <p class="text-xs text-gray-500">Document Scanner & PDF Tools</p>
                </div>
              </div>

              <nav class="hidden md:flex space-x-6">
                <button
                  (click)="navigateTo('/pdf-master')"
                  [class.text-blue-600]="currentRoute === '/pdf-master'"
                  [class.font-semibold]="currentRoute === '/pdf-master'"
                  class="text-gray-600 hover:text-blue-600 px-3 py-2 text-sm transition-colors"
                >
                  🎯 PDF Master
                </button>
                <button
                  (click)="navigateTo('/projects')"
                  [class.text-blue-600]="currentRoute === '/projects'"
                  [class.font-semibold]="currentRoute === '/projects'"
                  class="text-gray-600 hover:text-blue-600 px-3 py-2 text-sm transition-colors"
                >
                  📁 Projects
                </button>
                <button
                  (click)="navigateTo('/legacy-tools')"
                  [class.text-blue-600]="currentRoute === '/legacy-tools'"
                  [class.font-semibold]="currentRoute === '/legacy-tools'"
                  class="text-gray-600 hover:text-blue-600 px-3 py-2 text-sm transition-colors"
                >
                  🛠️ Legacy Tools
                </button>
              </nav>
            </div>

            <!-- Actions -->
            <div class="flex items-center space-x-4">
              <button
                (click)="createProject()"
                *ngIf="currentRoute === '/projects'"
                class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                + New Project
              </button>

              <!-- Mobile menu button -->
              <button
                (click)="mobileMenuOpen = !mobileMenuOpen"
                class="md:hidden p-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                ☰
              </button>
            </div>
          </div>

          <!-- Mobile Navigation -->
          <div *ngIf="mobileMenuOpen" class="md:hidden border-t border-gray-200 py-4">
            <nav class="space-y-2">
              <button
                (click)="navigateTo('/pdf-master')"
                [class.text-blue-600]="currentRoute === '/pdf-master'"
                [class.font-semibold]="currentRoute === '/pdf-master'"
                class="block w-full text-left px-3 py-2 text-gray-600 hover:text-blue-600 transition-colors"
              >
                🎯 PDF Master
              </button>
              <button
                (click)="navigateTo('/projects')"
                [class.text-blue-600]="currentRoute === '/projects'"
                [class.font-semibold]="currentRoute === '/projects'"
                class="block w-full text-left px-3 py-2 text-gray-600 hover:text-blue-600 transition-colors"
              >
                📁 Projects
              </button>
              <button
                (click)="navigateTo('/legacy-tools')"
                [class.text-blue-600]="currentRoute === '/legacy-tools'"
                [class.font-semibold]="currentRoute === '/legacy-tools'"
                class="block w-full text-left px-3 py-2 text-gray-600 hover:text-blue-600 transition-colors"
              >
                🛠️ Legacy Tools
              </button>
            </nav>
          </div>
        </div>
      </header>

      <!-- Main Content -->
      <main [class.pt-0]="!showNavigation">
        <router-outlet></router-outlet>
      </main>

      <!-- Quick Access Floating Button (when in project views) -->
      <div
        *ngIf="showFloatingButton"
        class="fixed bottom-6 right-6 flex flex-col space-y-3 z-40"
      >
        <!-- Scan Button -->
        <button
          (click)="startScanning()"
          class="w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-200 flex items-center justify-center hover:scale-110"
          title="Scan Document"
        >
          <span class="text-xl">📷</span>
        </button>

        <!-- Add Files Button -->
        <button
          (click)="uploadFiles()"
          class="w-12 h-12 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 transition-all duration-200 flex items-center justify-center hover:scale-110"
          title="Upload Files"
        >
          <span class="text-lg">📄</span>
        </button>
      </div>

      <!-- Hidden file input for floating button -->
      <input
        #floatingFileInput
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png"
        (change)="onFloatingFileSelect($event)"
        class="hidden"
      >
    </div>
  `,
  styles: [`
    .router-outlet-transition {
      transition: all 0.3s ease-in-out;
    }
  `]
})
export class AppComponent implements OnInit {
  title = 'pdf-master-angular';
  currentRoute = '';
  mobileMenuOpen = false;

  get showNavigation(): boolean {
    // Show navigation for most routes, hide for specific cases
    return !this.currentRoute.includes('/scanner');
  }

  get showFloatingButton(): boolean {
    // Show floating buttons in project views
    return this.currentRoute.includes('/projects/') && !this.currentRoute.endsWith('/projects');
  }

  constructor(
    private router: Router,
    private projectService: ProjectService
  ) {}

  ngOnInit(): void {
    // Track current route
    this.router.events.subscribe(() => {
      this.currentRoute = this.router.url;
      this.mobileMenuOpen = false; // Close mobile menu on route change
    });

    // Initialize services
    this.initializeApp();
  }

  private async initializeApp(): Promise<void> {
    try {
      // Any app-wide initialization can go here
      console.log('PDF Master Angular initialized');
    } catch (error) {
      console.error('Failed to initialize app:', error);
    }
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  createProject(): void {
    // This will trigger the create project dialog in ProjectListComponent
    // For now, navigate to projects and let the component handle it
    this.router.navigate(['/projects']);
  }

  startScanning(): void {
    // Navigate to scanner view - will implement in future phases
    console.log('Starting document scanner');
  }

  uploadFiles(): void {
    // Trigger file upload for current project
    const fileInput = document.querySelector('#floatingFileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  onFloatingFileSelect(event: any): void {
    // Handle file selection from floating button
    const files = Array.from(event.target.files) as File[];
    if (files.length > 0) {
      // Get current project ID from route
      const pathSegments = this.currentRoute.split('/');
      if (pathSegments[1] === 'projects' && pathSegments[2]) {
        const projectId = pathSegments[2];
        this.addFilesToProject(projectId, files);
      }
    }
    // Clear the input
    event.target.value = '';
  }

  private async addFilesToProject(projectId: string, files: File[]): Promise<void> {
    try {
      for (const file of files) {
        await this.projectService.addDocument(projectId, file);
      }
      console.log(`Added ${files.length} files to project`);
    } catch (error) {
      console.error('Failed to add files to project:', error);
    }
  }
}