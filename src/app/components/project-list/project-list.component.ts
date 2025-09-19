import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { takeUntil, map } from 'rxjs/operators';

import { Project, DEFAULT_PROJECT_TEMPLATES } from '../../models/project.model';
import { ProjectService, ProjectStats } from '../../services/project.service';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="min-h-screen bg-gray-50" [class.dark]="isDarkMode">
      <!-- Header -->
      <header class="bg-white border-b border-gray-200">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between items-center h-16">
            <div class="flex items-center">
              <h1 class="text-2xl font-bold text-gray-900">My Projects</h1>
              <span class="ml-3 px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full" *ngIf="stats$ | async as stats">
                {{stats.totalProjects}} projects
              </span>
            </div>
            <div class="flex items-center space-x-4">
              <button
                (click)="showCreateProjectDialog = true"
                class="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              >
                <span class="flex items-center">
                  <span class="mr-2">+</span> New Project
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <!-- Quick Stats -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8" *ngIf="stats$ | async as stats">
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span class="text-2xl">📁</span>
                </div>
              </div>
              <div class="ml-4">
                <p class="text-sm font-medium text-gray-500">Total Projects</p>
                <p class="text-2xl font-bold text-gray-900">{{stats.totalProjects}}</p>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <span class="text-2xl">📄</span>
                </div>
              </div>
              <div class="ml-4">
                <p class="text-sm font-medium text-gray-500">Documents</p>
                <p class="text-2xl font-bold text-gray-900">{{stats.totalDocuments}}</p>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <div class="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span class="text-2xl">📷</span>
                </div>
              </div>
              <div class="ml-4">
                <p class="text-sm font-medium text-gray-500">Scans</p>
                <p class="text-2xl font-bold text-gray-900">{{stats.totalScans}}</p>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <div class="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <span class="text-2xl">💾</span>
                </div>
              </div>
              <div class="ml-4">
                <p class="text-sm font-medium text-gray-500">Storage</p>
                <p class="text-2xl font-bold text-gray-900">{{formatSize(stats.totalSize)}}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Filter and Search -->
        <div class="mb-6">
          <div class="flex flex-col sm:flex-row gap-4">
            <div class="flex-1">
              <input
                type="text"
                placeholder="Search projects..."
                [(ngModel)]="searchQuery"
                (input)="onSearchChange()"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
            </div>
            <div class="flex items-center space-x-2">
              <button
                (click)="toggleStarredFilter()"
                [class.bg-yellow-100]="showStarredOnly"
                [class.text-yellow-800]="showStarredOnly"
                class="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                ⭐ Starred
              </button>
            </div>
          </div>
        </div>

        <!-- Projects Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" *ngIf="filteredProjects$ | async as projects">
          <!-- Empty State -->
          <div *ngIf="projects.length === 0" class="col-span-full text-center py-12">
            <div class="text-6xl mb-4">📁</div>
            <h3 class="text-lg font-medium text-gray-900 mb-2">No projects found</h3>
            <p class="text-gray-500 mb-6">Create your first project to get started</p>
            <button
              (click)="showCreateProjectDialog = true"
              class="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Project
            </button>
          </div>

          <!-- Project Cards -->
          <div
            *ngFor="let project of projects"
            class="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
            (click)="openProject(project)"
          >
            <div class="p-6">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center">
                  <div
                    class="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
                    [style.background-color]="project.color || '#3B82F6'"
                  >
                    {{project.templateType?.icon || '📄'}}
                  </div>
                  <div class="ml-3">
                    <h3 class="text-lg font-semibold text-gray-900">{{project.name}}</h3>
                    <p class="text-sm text-gray-500">{{formatDate(project.updatedAt)}}</p>
                  </div>
                </div>
                <div class="flex items-center space-x-2">
                  <button
                    (click)="toggleStar(project, $event)"
                    class="p-1 text-gray-400 hover:text-yellow-500 transition-colors"
                    [class.text-yellow-500]="project.isStarred"
                  >
                    ⭐
                  </button>
                  <button
                    (click)="showProjectMenu(project, $event)"
                    class="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    ⋮
                  </button>
                </div>
              </div>

              <div class="mb-4" *ngIf="project.description">
                <p class="text-sm text-gray-600">{{project.description}}</p>
              </div>

              <div class="flex items-center justify-between text-sm text-gray-500">
                <div class="flex items-center space-x-4">
                  <span>📄 {{project.documentCount}} docs</span>
                  <span>💾 {{formatSize(project.totalSize)}}</span>
                </div>
                <div class="flex flex-wrap gap-1">
                  <span
                    *ngFor="let tag of project.tags.slice(0, 2)"
                    class="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                  >
                    {{tag}}
                  </span>
                  <span
                    *ngIf="project.tags.length > 2"
                    class="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                  >
                    +{{project.tags.length - 2}}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <!-- Create Project Dialog -->
      <div
        *ngIf="showCreateProjectDialog"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        (click)="closeCreateProjectDialog()"
      >
        <div
          class="bg-white rounded-lg p-6 max-w-md w-full mx-4"
          (click)="$event.stopPropagation()"
        >
          <h2 class="text-xl font-bold mb-4">Create New Project</h2>

          <form (ngSubmit)="createProject()" #projectForm="ngForm">
            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-2">Project Name</label>
              <input
                type="text"
                [(ngModel)]="newProject.name"
                name="name"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter project name"
              >
            </div>

            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-2">Description (optional)</label>
              <textarea
                [(ngModel)]="newProject.description"
                name="description"
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Brief description of the project"
              ></textarea>
            </div>

            <div class="mb-6">
              <label class="block text-sm font-medium text-gray-700 mb-2">Template</label>
              <div class="grid grid-cols-2 gap-2">
                <button
                  *ngFor="let template of projectTemplates"
                  type="button"
                  (click)="selectTemplate(template.id)"
                  [class.ring-2]="newProject.templateId === template.id"
                  [class.ring-blue-500]="newProject.templateId === template.id"
                  class="p-3 border border-gray-300 rounded-lg hover:bg-gray-50 text-left transition-all"
                >
                  <div class="flex items-center mb-1">
                    <span class="text-lg mr-2">{{template.icon}}</span>
                    <span class="font-medium text-sm">{{template.name}}</span>
                  </div>
                  <p class="text-xs text-gray-500">{{template.description}}</p>
                </button>
              </div>
            </div>

            <div class="flex justify-end space-x-3">
              <button
                type="button"
                (click)="closeCreateProjectDialog()"
                class="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                [disabled]="!projectForm.valid || isCreating"
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {{isCreating ? 'Creating...' : 'Create Project'}}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dark {
      background-color: #111827;
      color: #f9fafb;
    }
    .dark .bg-white {
      background-color: #1f2937;
      border-color: #374151;
    }
    .dark .text-gray-900 {
      color: #f9fafb;
    }
    .dark .text-gray-500 {
      color: #9ca3af;
    }
  `]
})
export class ProjectListComponent implements OnInit, OnDestroy {
  projects$: Observable<Project[]>;
  filteredProjects$: Observable<Project[]>;
  stats$: Observable<ProjectStats>;

  searchQuery = '';
  showStarredOnly = false;
  showCreateProjectDialog = false;
  isDarkMode = false;
  isCreating = false;

  newProject = {
    name: '',
    description: '',
    templateId: 'general'
  };

  projectTemplates = DEFAULT_PROJECT_TEMPLATES;

  private destroy$ = new Subject<void>();

  constructor(
    private projectService: ProjectService,
    private router: Router
  ) {
    this.projects$ = this.projectService.projects$;
    this.filteredProjects$ = this.projects$;
    this.stats$ = this.projectService.stats$;
  }

  ngOnInit(): void {
    this.updateFilteredProjects();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchChange(): void {
    this.updateFilteredProjects();
  }

  toggleStarredFilter(): void {
    this.showStarredOnly = !this.showStarredOnly;
    this.updateFilteredProjects();
  }

  openProject(project: Project): void {
    this.router.navigate(['/projects', project.id]);
  }

  async toggleStar(project: Project, event: Event): Promise<void> {
    event.stopPropagation();
    await this.projectService.toggleProjectStar(project.id);
  }

  showProjectMenu(project: Project, event: Event): void {
    event.stopPropagation();
    // Show context menu - will implement
    console.log('Show menu for project:', project.name);
  }

  selectTemplate(templateId: string): void {
    this.newProject.templateId = templateId;
  }

  async createProject(): Promise<void> {
    if (!this.newProject.name.trim()) return;

    this.isCreating = true;
    try {
      await this.projectService.createProject(
        this.newProject.name,
        this.newProject.description,
        this.newProject.templateId
      );
      this.closeCreateProjectDialog();
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      this.isCreating = false;
    }
  }

  closeCreateProjectDialog(): void {
    this.showCreateProjectDialog = false;
    this.newProject = {
      name: '',
      description: '',
      templateId: 'general'
    };
  }

  formatDate(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;

    return date.toLocaleDateString();
  }

  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  private updateFilteredProjects(): void {
    this.filteredProjects$ = this.projectService.searchProjects(this.searchQuery).pipe(
      map(projects => {
        if (this.showStarredOnly) {
          return projects.filter(p => p.isStarred);
        }
        return projects;
      })
    );
  }
}