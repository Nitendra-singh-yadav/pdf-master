# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is PDF Master Angular - a comprehensive PDF manipulation application built with Angular 17 that provides 30+ PDF tools including conversion, compression, merging, splitting, security features, and more. The application is converted from a React implementation and features a modern UI with Tailwind CSS.

## Common Development Commands

### Development Server
```bash
ng serve
# or
npm start
```
- Starts development server on http://localhost:4200/
- Auto-reloads on file changes

### Build
```bash
ng build                    # Production build
ng build --configuration development  # Development build
npm run build              # Production build
npm run watch              # Development build with watch mode
```
- Production builds go to `dist/pdf-master-angular/`

### Testing
```bash
ng test
# or
npm test
```
- Runs unit tests via Karma and Jasmine
- Tests run in watch mode by default

### Angular CLI Commands
```bash
ng generate component component-name    # Generate new component
ng generate service service-name        # Generate new service
ng generate directive directive-name    # Generate new directive
ng generate pipe pipe-name             # Generate new pipe
```

## Architecture Overview

### Core State Management
- **PdfStateService** (`src/app/services/pdf-state.service.ts`): Central state management for PDF files, selections, and operations
- **SnapshotService** (`src/app/services/snapshot.service.ts`): Handles undo/redo functionality with state snapshots
- **PdfUtilsService** (`src/app/services/pdf-utils.service.ts`): PDF manipulation utilities using pdf-lib and pdfjs-dist

### Key State Interface
```typescript
interface PdfState {
  files: File[];              // Uploaded PDF files
  selectedIndex: number | null; // Currently selected file
  currentPage: number;         // Current page in preview
  numPages: number;           // Total pages in selected PDF
  selectedPages: number[];    // Selected pages for operations
  zoom: number;              // Preview zoom level
  error: string | null;      // Error messages
  reorderedPages: any[] | null; // Reordered page data
  isReordered: boolean;      // Whether pages have been reordered
  lastOperation: string | null; // Last performed operation
  operationTimestamp: number | null; // When operation occurred
}
```

### Component Architecture
- **Standalone Components**: Uses Angular 17 standalone component architecture
- **Reactive Forms**: FormsModule imported for form handling
- **Observable Patterns**: RxJS for reactive state management
- **Service Injection**: Constructor injection for services

### PDF Processing Features
- **File Management**: Upload, preview, download, remove multiple PDFs
- **Conversion Tools**: PDF to/from Word, Excel, PowerPoint, Images
- **Organization**: Merge, split, delete pages, extract pages, rotate, reorder
- **Security**: Password protection, unlock, digital signatures, watermarks
- **Optimization**: Compress, optimize, repair, crop, resize PDFs
- **Preview System**: Full-featured PDF viewer with zoom, pan, navigation

### Styling & UI
- **Tailwind CSS**: Utility-first CSS framework
- **Responsive Design**: Mobile-first responsive layouts
- **Dark Mode**: Toggle-able dark mode support
- **Icons**: Emoji-based icons throughout the interface
- **Gradients**: Extensive use of CSS gradients for modern appearance

### Dependencies
- **Core**: Angular 17, RxJS, Zone.js
- **PDF Processing**: pdf-lib, pdfjs-dist
- **UI**: Tailwind CSS, @tailwindcss/typography, autoprefixer, postcss
- **Animation**: framer-motion (React library - may need Angular equivalent)
- **Icons**: @heroicons/react (React library - may need Angular equivalent)

### File Organization
```
src/app/
├── app.component.ts        # Main application component with inline template
├── app.config.ts          # Application configuration
├── app.routes.ts          # Routing configuration (currently empty)
└── services/              # Business logic services
    ├── pdf-state.service.ts    # State management
    ├── pdf-utils.service.ts    # PDF manipulation utilities
    └── snapshot.service.ts     # Undo/redo functionality
```

## Development Notes

### State Management Patterns
- Use `updateState()` method in PdfStateService for all state changes to ensure proper snapshot capture
- Operations are automatically tracked for undo/redo functionality
- Loading states are managed separately from main application state

### PDF Operations
- All PDF operations are asynchronous and should handle loading states
- Error handling is centralized through PdfStateService.setError()
- File updates preserve unique IDs for proper tracking

### Testing Considerations
- Services use dependency injection - mock services for unit tests
- Component uses OnPush change detection strategy implicitly through observables
- PDF operations may require mocking of FileReader and Blob APIs

### Performance Considerations
- PDF preview generation can be memory-intensive for large files
- State snapshots are stored in memory - consider limits for large operations
- File processing happens client-side - no server dependencies required