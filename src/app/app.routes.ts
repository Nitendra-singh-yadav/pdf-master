import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/pdf-master',
    pathMatch: 'full'
  },
  {
    path: 'pdf-master',
    loadComponent: () => import('./components/pdf-viewer.component').then(m => m.PdfViewerComponent)
  },
  {
    path: 'projects',
    loadComponent: () => import('./components/project-list/project-list.component').then(m => m.ProjectListComponent)
  },
  {
    path: 'projects/:id',
    loadComponent: () => import('./components/project-view/project-view.component').then(m => m.ProjectViewComponent)
  },
  {
    path: 'legacy-tools',
    loadComponent: () => import('./components/legacy-tools/legacy-tools.component').then(m => m.LegacyToolsComponent)
  },
  {
    path: '**',
    redirectTo: '/pdf-master'
  }
];
