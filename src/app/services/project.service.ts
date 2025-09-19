import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map, combineLatest } from 'rxjs';
import {
  Project,
  Document,
  Scan,
  DocumentType,
  DocumentStatus,
  DEFAULT_PROJECT_TEMPLATES
} from '../models/project.model';
import { StorageService } from './storage.service';
import { SnapshotService } from './snapshot.service';

export interface ProjectStats {
  totalProjects: number;
  totalDocuments: number;
  totalScans: number;
  totalSize: number;
  recentActivity: Date | null;
}

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private projectsSubject = new BehaviorSubject<Project[]>([]);
  private documentsSubject = new BehaviorSubject<Document[]>([]);
  private scansSubject = new BehaviorSubject<Scan[]>([]);
  private currentProjectSubject = new BehaviorSubject<Project | null>(null);
  private loadingSubject = new BehaviorSubject<{ [key: string]: boolean }>({});

  constructor(
    private storageService: StorageService,
    private snapshotService: SnapshotService
  ) {
    this.initializeService();
  }

  // Observables for components to subscribe to
  get projects$(): Observable<Project[]> {
    return this.projectsSubject.asObservable();
  }

  get documents$(): Observable<Document[]> {
    return this.documentsSubject.asObservable();
  }

  get scans$(): Observable<Scan[]> {
    return this.scansSubject.asObservable();
  }

  get currentProject$(): Observable<Project | null> {
    return this.currentProjectSubject.asObservable();
  }

  get loading$(): Observable<{ [key: string]: boolean }> {
    return this.loadingSubject.asObservable();
  }

  get stats$(): Observable<ProjectStats> {
    return combineLatest([
      this.projects$,
      this.documents$,
      this.scans$
    ]).pipe(
      map(([projects, documents, scans]) => ({
        totalProjects: projects.length,
        totalDocuments: documents.length,
        totalScans: scans.length,
        totalSize: documents.reduce((sum, doc) => sum + doc.fileSize, 0),
        recentActivity: this.getRecentActivity(projects, documents, scans)
      }))
    );
  }

  // Current state getters
  get currentProjects(): Project[] {
    return this.projectsSubject.value;
  }

  get currentDocuments(): Document[] {
    return this.documentsSubject.value;
  }

  get currentScans(): Scan[] {
    return this.scansSubject.value;
  }

  get currentProject(): Project | null {
    return this.currentProjectSubject.value;
  }

  // Project CRUD operations
  async createProject(
    name: string,
    description?: string,
    templateId?: string,
    tags: string[] = []
  ): Promise<Project> {
    this.setLoading('createProject', true);

    try {
      const template = DEFAULT_PROJECT_TEMPLATES.find(t => t.id === templateId) || DEFAULT_PROJECT_TEMPLATES[0];

      const project: Project = {
        id: this.generateId(),
        name,
        description,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: tags.length > 0 ? tags : template.suggestedTags,
        color: template.color,
        documentCount: 0,
        totalSize: 0,
        isStarred: false,
        templateType: template
      };

      await this.storageService.create('projects', project);
      await this.loadProjects();

      // Capture operation for undo/redo
      this.snapshotService.captureOperation('Create Project', null, project);

      return project;
    } finally {
      this.setLoading('createProject', false);
    }
  }

  async updateProject(projectId: string, updates: Partial<Project>): Promise<Project> {
    this.setLoading('updateProject', true);

    try {
      const existingProject = await this.storageService.read<Project>('projects', projectId);
      if (!existingProject) {
        throw new Error('Project not found');
      }

      const updatedProject: Project = {
        ...existingProject,
        ...updates,
        updatedAt: new Date()
      };

      await this.storageService.update('projects', updatedProject);
      await this.loadProjects();

      // Update current project if it's the one being updated
      if (this.currentProject?.id === projectId) {
        this.currentProjectSubject.next(updatedProject);
      }

      this.snapshotService.captureOperation('Update Project', existingProject, updatedProject);

      return updatedProject;
    } finally {
      this.setLoading('updateProject', false);
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    this.setLoading('deleteProject', true);

    try {
      const project = await this.storageService.read<Project>('projects', projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Delete all associated documents and scans
      const documents = await this.storageService.query<Document>('documents', 'projectId', projectId);
      const scans = await this.storageService.query<Scan>('scans', 'projectId', projectId);

      // Delete files first
      for (const doc of documents) {
        if (doc.originalFile) {
          await this.storageService.deleteFile(`${doc.id}-original`);
        }
        if (doc.processedFile) {
          await this.storageService.deleteFile(`${doc.id}-processed`);
        }
      }

      for (const scan of scans) {
        await this.storageService.deleteFile(`${scan.id}-image`);
        if (scan.processedImage) {
          await this.storageService.deleteFile(`${scan.id}-processed`);
        }
      }

      // Delete documents and scans
      for (const doc of documents) {
        await this.storageService.delete('documents', doc.id);
      }
      for (const scan of scans) {
        await this.storageService.delete('scans', scan.id);
      }

      // Finally delete the project
      await this.storageService.delete('projects', projectId);
      await this.loadProjects();

      // Clear current project if it was deleted
      if (this.currentProject?.id === projectId) {
        this.currentProjectSubject.next(null);
      }

      this.snapshotService.captureOperation('Delete Project', project, null);
    } finally {
      this.setLoading('deleteProject', false);
    }
  }

  async duplicateProject(projectId: string, newName?: string): Promise<Project> {
    this.setLoading('duplicateProject', true);

    try {
      const originalProject = await this.storageService.read<Project>('projects', projectId);
      if (!originalProject) {
        throw new Error('Project not found');
      }

      const duplicatedProject: Project = {
        ...originalProject,
        id: this.generateId(),
        name: newName || `${originalProject.name} (Copy)`,
        createdAt: new Date(),
        updatedAt: new Date(),
        documentCount: 0,
        totalSize: 0
      };

      await this.storageService.create('projects', duplicatedProject);
      await this.loadProjects();

      this.snapshotService.captureOperation('Duplicate Project', null, duplicatedProject);

      return duplicatedProject;
    } finally {
      this.setLoading('duplicateProject', false);
    }
  }

  async toggleProjectStar(projectId: string): Promise<void> {
    const project = this.currentProjects.find(p => p.id === projectId);
    if (project) {
      await this.updateProject(projectId, { isStarred: !project.isStarred });
    }
  }

  // Document operations
  async addDocument(
    projectId: string,
    file: File,
    type: DocumentType = DocumentType.PDF
  ): Promise<Document> {
    this.setLoading('addDocument', true);

    try {
      const document: Document = {
        id: this.generateId(),
        projectId,
        name: file.name,
        type,
        createdAt: new Date(),
        updatedAt: new Date(),
        pageCount: type === DocumentType.PDF ? await this.getPageCount(file) : 1,
        fileSize: file.size,
        status: DocumentStatus.READY,
        isStarred: false
      };

      // Store the file
      await this.storageService.storeFile(`${document.id}-original`, file, document.id, 'document');

      // Save document metadata
      await this.storageService.create('documents', document);

      // Update project document count and size
      await this.updateProjectStats(projectId);
      await this.loadDocuments(projectId);

      this.snapshotService.captureOperation('Add Document', null, document);

      return document;
    } finally {
      this.setLoading('addDocument', false);
    }
  }

  async addScan(projectId: string, imageData: string, name: string): Promise<Scan> {
    this.setLoading('addScan', true);

    try {
      const scan: Scan = {
        id: this.generateId(),
        projectId,
        name,
        imageData,
        originalImage: imageData,
        createdAt: new Date(),
        updatedAt: new Date(),
        captureMethod: 'camera' as any,
        enhancement: {
          filter: 'enhanced' as any,
          brightness: 0,
          contrast: 0,
          saturation: 0,
          sharpness: 0,
          autoEnhance: true,
          removeBackground: false,
          perspectiveCorrection: true
        },
        isProcessed: false
      };

      await this.storageService.create('scans', scan);
      await this.loadScans(projectId);

      this.snapshotService.captureOperation('Add Scan', null, scan);

      return scan;
    } finally {
      this.setLoading('addScan', false);
    }
  }

  // Project navigation and state management
  async setCurrentProject(projectId: string): Promise<void> {
    const project = await this.storageService.read<Project>('projects', projectId);
    if (project) {
      this.currentProjectSubject.next(project);
      await this.loadDocuments(projectId);
      await this.loadScans(projectId);
    }
  }

  async clearCurrentProject(): Promise<void> {
    this.currentProjectSubject.next(null);
    this.documentsSubject.next([]);
    this.scansSubject.next([]);
  }

  // Search and filtering
  searchProjects(query: string, tags: string[] = []): Observable<Project[]> {
    return this.projects$.pipe(
      map(projects => projects.filter(project => {
        const matchesQuery = !query ||
          project.name.toLowerCase().includes(query.toLowerCase()) ||
          project.description?.toLowerCase().includes(query.toLowerCase());

        const matchesTags = tags.length === 0 ||
          tags.some(tag => project.tags.includes(tag));

        return matchesQuery && matchesTags;
      }))
    );
  }

  getRecentProjects(limit: number = 5): Observable<Project[]> {
    return this.projects$.pipe(
      map(projects =>
        projects
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
          .slice(0, limit)
      )
    );
  }

  getStarredProjects(): Observable<Project[]> {
    return this.projects$.pipe(
      map(projects => projects.filter(p => p.isStarred))
    );
  }

  // Utility methods
  private async initializeService(): Promise<void> {
    try {
      await this.storageService.initialize();
      await this.loadProjects();
    } catch (error) {
      console.error('Failed to initialize ProjectService:', error);
    }
  }

  private async loadProjects(): Promise<void> {
    try {
      const projects = await this.storageService.list<Project>('projects');
      this.projectsSubject.next(projects.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()));
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  }

  private async loadDocuments(projectId: string): Promise<void> {
    try {
      const documents = await this.storageService.query<Document>('documents', 'projectId', projectId);
      this.documentsSubject.next(documents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  }

  private async loadScans(projectId: string): Promise<void> {
    try {
      const scans = await this.storageService.query<Scan>('scans', 'projectId', projectId);
      this.scansSubject.next(scans.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    } catch (error) {
      console.error('Failed to load scans:', error);
    }
  }

  private async updateProjectStats(projectId: string): Promise<void> {
    const documents = await this.storageService.query<Document>('documents', 'projectId', projectId);
    const totalSize = documents.reduce((sum, doc) => sum + doc.fileSize, 0);

    await this.updateProject(projectId, {
      documentCount: documents.length,
      totalSize
    });
  }

  private async getPageCount(file: File): Promise<number> {
    // For now, return 1. In a real implementation, you'd analyze the PDF
    // This would integrate with your existing PdfUtilsService
    return 1;
  }

  private setLoading(operation: string, loading: boolean): void {
    const current = this.loadingSubject.value;
    this.loadingSubject.next({
      ...current,
      [operation]: loading
    });
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getRecentActivity(projects: Project[], documents: Document[], scans: Scan[]): Date | null {
    const allDates = [
      ...projects.map(p => p.updatedAt),
      ...documents.map(d => d.updatedAt),
      ...scans.map(s => s.updatedAt)
    ];

    if (allDates.length === 0) return null;

    return new Date(Math.max(...allDates.map(date => date.getTime())));
  }
}