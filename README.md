# 📄 PDF Master Angular

A comprehensive PDF manipulation application built with Angular 17 that provides 30+ powerful PDF tools including conversion, compression, merging, splitting, security features, and advanced annotation capabilities.

[![Angular](https://img.shields.io/badge/Angular-17-red.svg)](https://angular.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Contributions Welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](CONTRIBUTING.md)

## ✨ Features

### 📁 File Management
- **Multiple PDF Upload**: Drag & drop or select multiple PDF files
- **Smart Preview System**: High-quality thumbnails with lazy loading
- **File Organization**: Batch operations on multiple PDFs
- **Download Management**: Individual or bulk download options

### 🔄 PDF Conversion Tools
- **PDF to Office**: Convert to Word, Excel, PowerPoint formats
- **PDF to Images**: Export as PNG, JPG with customizable quality/DPI
- **Office to PDF**: Import and convert Word, Excel, PowerPoint to PDF
- **Batch Conversion**: Process multiple files simultaneously

### 📊 Organization & Management
- **Smart Merge**: Combine multiple PDFs with custom page selection
- **Intelligent Split**: Split by pages, page ranges, or file size
- **Page Operations**: Delete, extract, reorder, and rotate pages
- **Page Management**: Visual drag-and-drop page reordering

### 🔒 Security & Protection
- **Password Protection**: Add password encryption to PDFs
- **Unlock PDFs**: Remove passwords from protected files
- **Digital Signatures**: Apply digital signatures for document integrity
- **Watermarks**: Add text or image watermarks with custom positioning

### 🎨 Advanced Annotation System
- **Drawing Tools**: Rectangles, circles/ellipses, lines, arrows
- **Text Annotations**: Add custom text with font styling
- **Highlighting**: Mark important sections with colored highlights
- **Freehand Drawing**: Sketch directly on PDF pages
- **Interactive Editing**: Real-time annotation preview and editing

### ⚡ Optimization & Enhancement
- **Smart Compression**: Reduce file size with quality options
- **PDF Repair**: Fix corrupted or damaged PDF files
- **Page Cropping**: Remove unwanted margins and sections
- **Image Optimization**: Optimize embedded images for smaller files

### 🔧 Advanced Features
- **Undo/Redo System**: Full operation history with snapshots
- **Zoom & Pan**: Detailed page viewing with smooth navigation
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Dark Mode**: Toggle between light and dark themes
- **Offline Capable**: Client-side processing for privacy and speed

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Modern web browser with ES2020 support

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Nitendra-singh-yadav/pdf-master.git
   cd pdf-master-angular
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   ng serve
   # or
   npm start
   ```

4. **Open your browser**
   Navigate to `http://localhost:4200/`

### Building for Production

```bash
ng build
# Output will be in dist/pdf-master-angular/
```

## 🏗️ Architecture

### Core Technologies
- **Frontend**: Angular 17 with standalone components
- **Styling**: Tailwind CSS with responsive design
- **PDF Processing**: pdf-lib and pdfjs-dist for client-side operations
- **State Management**: Reactive services with RxJS observables
- **Type Safety**: Full TypeScript implementation

### Key Services
- **PdfEngineService**: Core PDF manipulation and processing
- **PdfStateService**: Application state management
- **SnapshotService**: Undo/redo functionality with operation history
- **WebWorkerService**: Background processing for large files

### Component Architecture
```
src/app/
├── components/           # UI components
│   ├── page-editor/     # PDF annotation and editing
│   ├── pdf-viewer/      # PDF preview and navigation
│   ├── project-view/    # Main application interface
│   └── pdf-preview-grid/ # Thumbnail grid display
├── services/            # Business logic and state management
├── models/              # TypeScript interfaces and types
└── workers/             # Web workers for background processing
```

## 📖 Usage Guide

### Basic Operations
1. **Upload PDFs**: Drag files into the upload area or click to select
2. **Preview & Navigate**: Use the thumbnail grid to browse pages
3. **Select Pages**: Click thumbnails to select specific pages for operations
4. **Apply Operations**: Use the toolbar to merge, split, compress, or convert

### Annotation Features
1. **Select Tool**: Choose from text, shapes, highlighting, or drawing tools
2. **Draw on PDF**: Click and drag to create annotations
3. **Customize Style**: Adjust colors, opacity, stroke width, and fonts
4. **Apply to PDF**: Save annotations permanently to the PDF file

### Advanced Workflows
- **Batch Processing**: Select multiple files for simultaneous operations
- **Custom Page Ranges**: Specify exact pages for split/merge operations
- **Quality Control**: Preview changes before applying to original files
- **Operation History**: Use undo/redo to revert unwanted changes

## 🤝 Contributing

We welcome contributions from the community! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting pull requests.

### Development Guidelines
- Follow Angular and TypeScript best practices
- Maintain comprehensive test coverage
- Update documentation for new features
- Ensure responsive design compatibility

### Getting Help
- 📖 Check the [Documentation](docs/)
- 🐛 Report bugs via [GitHub Issues](https://github.com/Nitendra-singh-yadav/pdf-master/issues)
- 💬 Join discussions in [GitHub Discussions](https://github.com/Nitendra-singh-yadav/pdf-master/discussions)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ☕ Support the Project

If you find PDF Master useful, consider supporting its development:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support%20Development-orange?style=for-the-badge&logo=buy-me-a-coffee)](https://buymeacoffee.com/nitendrasingh)

Your support helps maintain and improve PDF Master for everyone!

## 🌟 Acknowledgments

- Built with ❤️ using Angular and modern web technologies
- PDF processing powered by pdf-lib and PDF.js
- UI components styled with Tailwind CSS
- Icons provided by the community

## 📊 Project Stats

![GitHub stars](https://img.shields.io/github/stars/Nitendra-singh-yadav/pdf-master?style=social)
![GitHub forks](https://img.shields.io/github/forks/Nitendra-singh-yadav/pdf-master?style=social)
![GitHub issues](https://img.shields.io/github/issues/Nitendra-singh-yadav/pdf-master)
![GitHub pull requests](https://img.shields.io/github/issues-pr/Nitendra-singh-yadav/pdf-master)

---

<div align="center">
  <strong>Transform your PDF workflow with PDF Master Angular</strong>
  <br>
  <sub>Built by <a href="https://github.com/Nitendra-singh-yadav">Nitendra Singh Yadav</a> and contributors</sub>
</div>
