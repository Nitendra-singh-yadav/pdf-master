import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts, PageSizes, degrees } from 'pdf-lib';
import JSZip from 'jszip';
import { WebWorkerService } from './web-worker.service';
// import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';
import {
  PdfDocument,
  PdfPage,
  PdfMetadata,
  MergeConfig,
  SplitConfig,
  CompressConfig,
  ExportConfig,
  OperationType,
  createPdfPage
} from '../models/pdf-document.model';

// Disable PDF.js worker to prevent ArrayBuffer detachment issues
// Setting workerSrc to null disables the worker and forces main thread processing
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.149/build/pdf.worker.min.mjs';

export interface PdfOperationResult {
  success: boolean;
  data?: Uint8Array;
  pages?: PdfPage[];
  error?: string;
  metadata?: any;
}

export interface ThumbnailGenerationProgress {
  completed: number;
  total: number;
  currentPage: number;
}

@Injectable({
  providedIn: 'root'
})
export class PdfEngineService {
  private processingSubject = new BehaviorSubject<{ [key: string]: boolean }>({});
  private progressSubject = new BehaviorSubject<{ [key: string]: number }>({});

  constructor(readonly webWorkerService: WebWorkerService) {}

  get processing$(): Observable<{ [key: string]: boolean }> {
    return this.processingSubject.asObservable();
  }

  get progress$(): Observable<{ [key: string]: number }> {
    return this.progressSubject.asObservable();
  }

  /**
   * Load and parse PDF file
   */
  async loadPdfDocument(file: File): Promise<PdfDocument> {
    this.setProcessing('load', true);

    try {
      console.log('Loading PDF document:', file.name, 'Size:', file.size, 'Type:', file.type);

      // Validate file type
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('Invalid file type. Please select a PDF file.');
      }

      // Convert file to array buffer
      console.log('Converting file to array buffer...');
      const arrayBuffer = await file.arrayBuffer();
      console.log('Array buffer created, size:', arrayBuffer.byteLength);

      // Create separate copies for each library to avoid detached ArrayBuffer issues
      const pdfLibBuffer = arrayBuffer.slice(0);
      const pdfJsBuffer = arrayBuffer.slice(0);
      const documentBuffer = arrayBuffer.slice(0);

      // Load with pdf-lib
      console.log('Loading with pdf-lib...');
      const pdfDoc = await PDFDocument.load(pdfLibBuffer);
      console.log('PDF-lib loaded successfully, page count:', pdfDoc.getPageCount());

      // Load with PDF.js
      console.log('Loading with PDF.js...');
      const pdfjs = await pdfjsLib.getDocument({ data: pdfJsBuffer }).promise;
      console.log('PDF.js loaded successfully, page count:', pdfjs.numPages);

      const metadata = await this.extractMetadata(pdfDoc, pdfjs);
      const pages = await this.extractPages(pdfDoc, pdfjs, file.name);

      const document: PdfDocument = {
        id: `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        projectId: '', // Will be set by calling service
        name: file.name,
        pages,
        originalFile: file,
        currentVersion: new Uint8Array(documentBuffer),
        metadata,
        history: [],
        totalPages: pdfDoc.getPageCount(),
        fileSize: file.size,
        isProcessing: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      console.log('PDF document loaded successfully:', document.name);
      return document;
    } catch (error) {
      console.error('Failed to load PDF document:', error);
      throw error;
    } finally {
      this.setProcessing('load', false);
    }
  }

  /**
   * Generate thumbnails for PDF pages
   */
  async generateThumbnails(
    document: PdfDocument,
    options: {
      width?: number;
      quality?: number;
      startPage?: number;
      endPage?: number;
      onProgress?: (progress: ThumbnailGenerationProgress) => void;
      useWebWorker?: boolean;
    } = {}
  ): Promise<PdfPage[]> {
    const {
      width = 200,
      quality = 0.8,
      startPage = 1,
      endPage = document.totalPages,
      onProgress,
      useWebWorker = false // Disable Web Workers for now
    } = options;

    this.setProcessing('thumbnails', true);

    try {
      // Disable Web Workers for now to avoid ArrayBuffer detachment issues
      if (false && useWebWorker && typeof Worker !== 'undefined') {
        return await this.generateThumbnailsWithWorker(document, {
          width,
          quality,
          startPage,
          endPage,
          onProgress
        });
      } else {
        return await this.generateThumbnailsMainThread(document, {
          width,
          quality,
          startPage,
          endPage,
          onProgress
        });
      }
    } finally {
      this.setProcessing('thumbnails', false);
      this.setProgress('thumbnails', 0);
    }
  }

  /**
   * Regenerate thumbnail for a specific page
   */
  async regenerateThumbnail(
    document: PdfDocument,
    pageNumber: number,
    options: {
      width?: number;
      quality?: number;
    } = {}
  ): Promise<string | null> {
    const {
      width = 200,
      quality = 0.8
    } = options;

    try {
      const arrayBuffer = document.currentVersion.slice(0).buffer;
      const pdfjs = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      if (pageNumber < 1 || pageNumber > pdfjs.numPages) {
        return null;
      }

      const page = await pdfjs.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });

      // Calculate scale to achieve desired width
      const scale = width / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      // Create canvas
      const canvas = globalThis.document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;

      // Render page
      const renderContext = {
        canvasContext: context,
        viewport: scaledViewport,
        canvas: canvas
      };

      await page.render(renderContext).promise;

      // Convert to base64
      const thumbnail = canvas.toDataURL('image/jpeg', quality);

      console.log(`Regenerated thumbnail for page ${pageNumber}`);

      return thumbnail;
    } catch (error) {
      console.error(`Failed to regenerate thumbnail for page ${pageNumber}:`, error);
      return null;
    }
  }

  /**
   * Generate thumbnails using main thread
   */
  private async generateThumbnailsMainThread(
    document: PdfDocument,
    options: {
      width: number;
      quality: number;
      startPage: number;
      endPage: number;
      onProgress?: (progress: ThumbnailGenerationProgress) => void;
    }
  ): Promise<PdfPage[]> {
    const { width, quality, startPage, endPage, onProgress } = options;
    const arrayBuffer = document.currentVersion.slice(0).buffer; // Create a copy to avoid detachment
    const pdfjs = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const updatedPages = [...document.pages];

    for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
      const page = await pdfjs.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });

      // Calculate scale to achieve desired width
      const scale = width / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      // Create canvas
      const canvas = globalThis.document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;

      // Render page
      const renderContext = {
        canvasContext: context,
        viewport: scaledViewport,
        canvas: canvas
      };

      await page.render(renderContext).promise;

      // Convert to base64
      const thumbnail = canvas.toDataURL('image/jpeg', quality);

      // Update page
      const pageIndex = pageNum - 1;
      if (updatedPages[pageIndex]) {
        updatedPages[pageIndex] = {
          ...updatedPages[pageIndex],
          thumbnail,
          isVisible: true
        };
      }

      // Report progress
      if (onProgress) {
        onProgress({
          completed: pageNum - startPage + 1,
          total: endPage - startPage + 1,
          currentPage: pageNum
        });
      }

      this.setProgress('thumbnails', ((pageNum - startPage + 1) / (endPage - startPage + 1)) * 100);
    }

    return updatedPages;
  }

  /**
   * Generate thumbnails using Web Worker
   */
  private async generateThumbnailsWithWorker(
    document: PdfDocument,
    options: {
      width: number;
      quality: number;
      startPage: number;
      endPage: number;
      onProgress?: (progress: ThumbnailGenerationProgress) => void;
    }
  ): Promise<PdfPage[]> {
    const { width, quality, startPage, endPage, onProgress } = options;
    const updatedPages = [...document.pages];
    const totalPages = endPage - startPage + 1;
    let completedPages = 0;

    // Process pages in batches to avoid overwhelming the worker pool
    const batchSize = 5;
    const promises: Promise<void>[] = [];

    for (let pageNum = startPage; pageNum <= endPage; pageNum += batchSize) {
      const batchEnd = Math.min(pageNum + batchSize - 1, endPage);

      for (let batchPage = pageNum; batchPage <= batchEnd; batchPage++) {
        const promise = Promise.reject(new Error('Web Workers disabled')).then((thumbnail: any) => {
          const pageIndex = batchPage - 1;
          if (updatedPages[pageIndex]) {
            updatedPages[pageIndex] = {
              ...updatedPages[pageIndex],
              thumbnail,
              isVisible: true
            };
          }

          completedPages++;
          if (onProgress) {
            onProgress({
              completed: completedPages,
              total: totalPages,
              currentPage: batchPage
            });
          }

          this.setProgress('thumbnails', (completedPages / totalPages) * 100);
        });

        promises.push(promise);
      }

      // Wait for current batch before starting next one to manage memory
      await Promise.all(promises.splice(-batchSize));
    }

    // Wait for any remaining promises
    await Promise.all(promises);

    return updatedPages;
  }

  /**
   * Merge multiple PDF documents
   */
  async mergePdfs(documents: PdfDocument[], config: MergeConfig): Promise<PdfOperationResult> {
    this.setProcessing('merge', true);

    try {
      // Use Web Worker for large merge operations
      const totalPages = this.getTotalPagesToMerge(documents, config);

      if (false && totalPages > 50 && typeof Worker !== 'undefined') {
        return await this.mergePdfsWithWorker(documents, config);
      } else {
        return await this.mergePdfsMainThread(documents, config);
      }
    } finally {
      this.setProcessing('merge', false);
      this.setProgress('merge', 0);
    }
  }

  /**
   * Merge PDFs using main thread
   */
  private async mergePdfsMainThread(documents: PdfDocument[], config: MergeConfig): Promise<PdfOperationResult> {
    try {
      const mergedPdf = await PDFDocument.create();
      let pageCount = 0;

      for (const docId of config.documentIds) {
        const document = documents.find(d => d.id === docId);
        if (!document) continue;

        const sourcePdf = await PDFDocument.load(document.currentVersion);
        const pageRanges = config.pageRanges?.[docId] || Array.from(
          { length: document.totalPages },
          (_, i) => i
        );

        const copiedPages = await mergedPdf.copyPages(sourcePdf, pageRanges);
        copiedPages.forEach(page => mergedPdf.addPage(page));
        pageCount += copiedPages.length;

        this.setProgress('merge', (pageCount / this.getTotalPagesToMerge(documents, config)) * 100);
      }

      // Add metadata if requested
      if (config.metadata) {
        mergedPdf.setTitle(config.outputName);
        mergedPdf.setCreationDate(new Date());
        mergedPdf.setModificationDate(new Date());
      }

      const pdfBytes = await mergedPdf.save();

      return {
        success: true,
        data: pdfBytes,
        metadata: {
          pageCount,
          size: pdfBytes.length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Merge operation failed'
      };
    }
  }

  /**
   * Merge PDFs using Web Worker
   */
  private async mergePdfsWithWorker(documents: PdfDocument[], config: MergeConfig): Promise<PdfOperationResult> {
    try {
      const documentData = config.documentIds.map(docId => {
        const document = documents.find(d => d.id === docId);
        return {
          data: document!.currentVersion.buffer,
          pageRanges: config.pageRanges?.[docId]
        };
      });

      // Web Workers disabled due to ArrayBuffer detachment issues
      throw new Error('Merge operation requires Web Workers which are currently disabled');
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Merge operation failed'
      };
    }
  }

  /**
   * Split PDF document
   */
  async splitPdf(document: PdfDocument, config: SplitConfig): Promise<PdfOperationResult> {
    this.setProcessing('split', true);

    try {
      const sourcePdf = await PDFDocument.load(document.currentVersion);
      const splitResults: Uint8Array[] = [];

      if (config.method === 'pages') {
        // Split at specific pages
        const splitPoints = [0, ...config.pages!, document.totalPages];

        for (let i = 0; i < splitPoints.length - 1; i++) {
          const start = splitPoints[i];
          const end = splitPoints[i + 1] - 1;

          if (start <= end) {
            const newPdf = await PDFDocument.create();
            const pageRange = Array.from({ length: end - start + 1 }, (_, idx) => start + idx);
            const copiedPages = await newPdf.copyPages(sourcePdf, pageRange);
            copiedPages.forEach(page => newPdf.addPage(page));

            const pdfBytes = await newPdf.save();
            splitResults.push(pdfBytes);
          }
        }
      } else if (config.method === 'range') {
        // Split by ranges
        for (const range of config.ranges!) {
          const newPdf = await PDFDocument.create();
          const pageRange = Array.from(
            { length: range.end - range.start + 1 },
            (_, idx) => range.start - 1 + idx
          );
          const copiedPages = await newPdf.copyPages(sourcePdf, pageRange);
          copiedPages.forEach(page => newPdf.addPage(page));

          const pdfBytes = await newPdf.save();
          splitResults.push(pdfBytes);
        }
      }

      return {
        success: true,
        data: splitResults[0], // Return first split for simplicity
        metadata: {
          splitCount: splitResults.length,
          results: splitResults
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Split operation failed'
      };
    } finally {
      this.setProcessing('split', false);
    }
  }

  /**
   * Compress PDF
   */
  async compressPdf(document: PdfDocument, config: CompressConfig): Promise<PdfOperationResult> {
    this.setProcessing('compress', true);

    try {
      // Use Web Worker for large documents
      if (false && document.fileSize > 5 * 1024 * 1024 && typeof Worker !== 'undefined') { // 5MB threshold
        return await this.compressPdfWithWorker(document, config);
      } else {
        return await this.compressPdfMainThread(document, config);
      }
    } finally {
      this.setProcessing('compress', false);
    }
  }

  /**
   * Compress PDF using main thread
   */
  private async compressPdfMainThread(document: PdfDocument, config: CompressConfig): Promise<PdfOperationResult> {
    try {
      const sourcePdf = await PDFDocument.load(document.currentVersion);

      // Basic compression - for advanced compression, we'd need additional libraries
      let qualityMultiplier = 1;
      switch (config.quality) {
        case 'low': qualityMultiplier = 0.3; break;
        case 'medium': qualityMultiplier = 0.5; break;
        case 'high': qualityMultiplier = 0.8; break;
        case 'custom': qualityMultiplier = (config.customQuality || 50) / 100; break;
      }

      // Remove metadata if requested
      if (config.removeMetadata) {
        sourcePdf.setTitle('');
        sourcePdf.setAuthor('');
        sourcePdf.setSubject('');
        sourcePdf.setKeywords([]);
      }

      const compressedBytes = await sourcePdf.save({
        useObjectStreams: true,
        addDefaultPage: false,
        objectsPerTick: 50
      });

      const compressionRatio = compressedBytes.length / document.currentVersion.length;

      return {
        success: true,
        data: compressedBytes,
        metadata: {
          originalSize: document.currentVersion.length,
          compressedSize: compressedBytes.length,
          compressionRatio,
          spaceSaved: document.currentVersion.length - compressedBytes.length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Compression failed'
      };
    }
  }

  /**
   * Compress PDF using Web Worker
   */
  private async compressPdfWithWorker(document: PdfDocument, config: CompressConfig): Promise<PdfOperationResult> {
    try {
      // Web Workers disabled due to ArrayBuffer detachment issues
      throw new Error('Compression operation requires Web Workers which are currently disabled');
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Compression failed'
      };
    }
  }

  /**
   * Rotate pages
   */
  async rotatePages(
    document: PdfDocument,
    pageNumbers: number[],
    angle: number
  ): Promise<PdfOperationResult> {
    this.setProcessing('rotate', true);

    try {
      const pdfDoc = await PDFDocument.load(document.currentVersion);
      const pages = pdfDoc.getPages();

      for (const pageNum of pageNumbers) {
        if (pageNum > 0 && pageNum <= pages.length) {
          const page = pages[pageNum - 1];
          page.setRotation(degrees(angle));
        }
      }

      const rotatedBytes = await pdfDoc.save();

      return {
        success: true,
        data: rotatedBytes,
        metadata: {
          rotatedPages: pageNumbers,
          angle
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Rotation failed'
      };
    } finally {
      this.setProcessing('rotate', false);
    }
  }

  /**
   * Delete pages
   */
  async deletePages(document: PdfDocument, pageNumbers: number[]): Promise<PdfOperationResult> {
    this.setProcessing('delete', true);

    try {
      const sourcePdf = await PDFDocument.load(document.currentVersion);
      const newPdf = await PDFDocument.create();

      const pagesToKeep = Array.from(
        { length: document.totalPages },
        (_, i) => i + 1
      ).filter(pageNum => !pageNumbers.includes(pageNum));

      if (pagesToKeep.length === 0) {
        throw new Error('Cannot delete all pages');
      }

      const copiedPages = await newPdf.copyPages(sourcePdf, pagesToKeep.map(p => p - 1));
      copiedPages.forEach(page => newPdf.addPage(page));

      const resultBytes = await newPdf.save();

      return {
        success: true,
        data: resultBytes,
        metadata: {
          deletedPages: pageNumbers,
          remainingPages: pagesToKeep.length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delete operation failed'
      };
    } finally {
      this.setProcessing('delete', false);
    }
  }

  /**
   * Add watermark to pages
   */
  async addWatermark(
    document: PdfDocument,
    pageNumbers: number[],
    watermarkConfig: {
      text?: string;
      image?: string;
      position: string;
      opacity: number;
      fontSize?: number;
      color?: string;
      rotation?: number;
    }
  ): Promise<PdfOperationResult> {
    this.setProcessing('watermark', true);

    try {
      const pdfDoc = await PDFDocument.load(document.currentVersion);
      const pages = pdfDoc.getPages();

      for (const pageNum of pageNumbers) {
        if (pageNum > 0 && pageNum <= pages.length) {
          const page = pages[pageNum - 1];
          const { width, height } = page.getSize();

          if (watermarkConfig.text) {
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const fontSize = watermarkConfig.fontSize || 36;
            const textWidth = font.widthOfTextAtSize(watermarkConfig.text, fontSize);
            const textHeight = fontSize;

            let x = width / 2 - textWidth / 2;
            let y = height / 2 - textHeight / 2;

            // Adjust position based on config
            switch (watermarkConfig.position) {
              case 'top-left':
                x = 50; y = height - 50 - textHeight;
                break;
              case 'top-right':
                x = width - 50 - textWidth; y = height - 50 - textHeight;
                break;
              case 'bottom-left':
                x = 50; y = 50;
                break;
              case 'bottom-right':
                x = width - 50 - textWidth; y = 50;
                break;
            }

            page.drawText(watermarkConfig.text, {
              x,
              y,
              size: fontSize,
              font,
              color: rgb(0.5, 0.5, 0.5),
              opacity: watermarkConfig.opacity,
              rotate: degrees(watermarkConfig.rotation || 0)
            });
          }
        }
      }

      const watermarkedBytes = await pdfDoc.save();

      return {
        success: true,
        data: watermarkedBytes,
        metadata: {
          watermarkedPages: pageNumbers
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Watermark operation failed'
      };
    } finally {
      this.setProcessing('watermark', false);
    }
  }

  /**
   * Apply all annotations from all pages to PDF
   */
  async applyAllAnnotations(document: PdfDocument): Promise<PdfOperationResult> {
    this.setProcessing('annotate', true);

    try {
      // Get all pages with annotations
      const pagesWithAnnotations = document.pages.filter(page =>
        page.annotations && page.annotations.length > 0
      );

      if (pagesWithAnnotations.length === 0) {
        return { success: true, data: document.currentVersion };
      }

      console.log(`Applying annotations from ${pagesWithAnnotations.length} pages...`);

      // Load the PDF document once
      const pdfDoc = await PDFDocument.load(document.currentVersion);
      const pdfPages = pdfDoc.getPages();

      let totalAnnotationsApplied = 0;

      // Apply annotations for each page that has them
      for (const page of pagesWithAnnotations) {
        const pageIndex = page.pageNumber - 1;
        const pdfPage = pdfPages[pageIndex];

        if (!pdfPage) {
          console.warn(`Page ${page.pageNumber} not found in PDF, skipping...`);
          continue;
        }

        console.log(`Applying ${page.annotations.length} annotations to page ${page.pageNumber}...`);

        const { width: pdfWidth, height: pdfHeight } = pdfPage.getSize();

        // Get the canvas dimensions used during annotation creation
        const canvasWidth = page.originalDimensions?.width || page.currentDimensions.width;
        const canvasHeight = page.originalDimensions?.height || page.currentDimensions.height;

        console.log(`Page ${page.pageNumber} - PDF: ${pdfWidth}x${pdfHeight}, Canvas: ${canvasWidth}x${canvasHeight}`);

        // Calculate scaling factors
        const scaleX = pdfWidth / canvasWidth;
        const scaleY = pdfHeight / canvasHeight;

        for (const annotation of page.annotations) {
          const pos = annotation.position;
          const style = annotation.style;

          // Convert canvas coordinates to PDF coordinates
          const x = pos.x * scaleX;
          const y = pdfHeight - (pos.y * scaleY); // Flip Y coordinate
          const w = pos.width * scaleX;
          const h = pos.height * scaleY;

          console.log(`Annotation ${annotation.type} on page ${page.pageNumber}:`, {
            canvas: { x: pos.x, y: pos.y, w: pos.width, h: pos.height },
            pdf: { x, y, w, h },
            scale: { scaleX, scaleY }
          });

          switch (annotation.type) {
            case 'text':
              if (annotation.content) {
                const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
                pdfPage.drawText(annotation.content, {
                  x,
                  y: y - h,
                  size: style.fontSize || 12,
                  font,
                  color: this.hexToRgb(style.color),
                  opacity: style.opacity
                });
              }
              break;

            case 'highlight':
              pdfPage.drawRectangle({
                x,
                y: y - h,
                width: w,
                height: h,
                color: this.hexToRgb(style.color),
                opacity: style.opacity * 0.3
              });
              break;

            case 'rectangle':
              pdfPage.drawRectangle({
                x,
                y: y - h,
                width: w,
                height: h,
                borderColor: this.hexToRgb(style.color),
                borderWidth: style.strokeWidth || 2,
                color: style.fillColor ? this.hexToRgb(style.fillColor) : undefined,
                opacity: style.opacity
              });
              break;

            case 'circle':
              const centerX = x + w / 2;
              const centerY = y - h / 2;
              const radiusX = w / 2;
              const radiusY = h / 2;

              // Draw ellipse as a series of lines to support different radiusX and radiusY
              const points = 64; // Increased for smoother ellipses
              for (let i = 0; i < points; i++) {
                const angle1 = (i * 2 * Math.PI) / points;
                const angle2 = ((i + 1) * 2 * Math.PI) / points;

                const x1 = centerX + radiusX * Math.cos(angle1);
                const y1 = centerY + radiusY * Math.sin(angle1);
                const x2 = centerX + radiusX * Math.cos(angle2);
                const y2 = centerY + radiusY * Math.sin(angle2);

                pdfPage.drawLine({
                  start: { x: x1, y: y1 },
                  end: { x: x2, y: y2 },
                  color: this.hexToRgb(style.color),
                  thickness: style.strokeWidth || 2,
                  opacity: style.opacity
                });
              }
              break;

            case 'line':
              pdfPage.drawLine({
                start: { x, y },
                end: { x: x + w, y: y - h },
                color: this.hexToRgb(style.color),
                thickness: style.strokeWidth || 2,
                opacity: style.opacity
              });
              break;

            case 'arrow':
              // Draw line
              const endX = x + w;
              const endY = y - h;
              pdfPage.drawLine({
                start: { x, y },
                end: { x: endX, y: endY },
                color: this.hexToRgb(style.color),
                thickness: style.strokeWidth || 2,
                opacity: style.opacity
              });

              // Draw arrowhead
              const arrowLength = 10;
              const arrowAngle = Math.PI / 6;
              const lineAngle = Math.atan2(endY - y, endX - x);

              const arrowPoint1X = endX - arrowLength * Math.cos(lineAngle - arrowAngle);
              const arrowPoint1Y = endY - arrowLength * Math.sin(lineAngle - arrowAngle);
              const arrowPoint2X = endX - arrowLength * Math.cos(lineAngle + arrowAngle);
              const arrowPoint2Y = endY - arrowLength * Math.sin(lineAngle + arrowAngle);

              pdfPage.drawLine({
                start: { x: endX, y: endY },
                end: { x: arrowPoint1X, y: arrowPoint1Y },
                color: this.hexToRgb(style.color),
                thickness: style.strokeWidth || 2,
                opacity: style.opacity
              });

              pdfPage.drawLine({
                start: { x: endX, y: endY },
                end: { x: arrowPoint2X, y: arrowPoint2Y },
                color: this.hexToRgb(style.color),
                thickness: style.strokeWidth || 2,
                opacity: style.opacity
              });
              break;
          }

          totalAnnotationsApplied++;
        }
      }

      // Save the PDF with all annotations applied
      const annotatedBytes = await pdfDoc.save();

      console.log(`Successfully applied ${totalAnnotationsApplied} annotations across ${pagesWithAnnotations.length} pages`);

      return {
        success: true,
        data: annotatedBytes,
        metadata: {
          pagesWithAnnotations: pagesWithAnnotations.length,
          totalAnnotationsApplied
        }
      };
    } catch (error) {
      console.error('Failed to apply all annotations:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Annotation application failed'
      };
    } finally {
      this.setProcessing('annotate', false);
    }
  }

  /**
   * Apply annotations to PDF (single page - legacy method)
   */
  async applyAnnotations(document: PdfDocument, pageId: string): Promise<PdfOperationResult> {
    this.setProcessing('annotate', true);

    try {
      const page = document.pages.find(p => p.id === pageId);
      if (!page || page.annotations.length === 0) {
        return { success: true, data: document.currentVersion };
      }

      const pdfDoc = await PDFDocument.load(document.currentVersion);
      const pdfPage = pdfDoc.getPages()[page.pageNumber - 1];

      if (!pdfPage) {
        throw new Error('Page not found in PDF');
      }

      const { width: pdfWidth, height: pdfHeight } = pdfPage.getSize();

      // Get scaling factors - the key insight is that annotations are stored in canvas coordinates
      // We need to convert them to PDF coordinates which may have different dimensions
      const canvasWidth = page.currentDimensions.width;
      const canvasHeight = page.currentDimensions.height;

      const scaleX = pdfWidth / canvasWidth;
      const scaleY = pdfHeight / canvasHeight;

      console.log('Coordinate conversion info:', {
        pdfSize: { pdfWidth, pdfHeight },
        canvasSize: { canvasWidth, canvasHeight },
        scale: { scaleX, scaleY }
      });
      console.log('Applying', page.annotations.length, 'annotations');

      for (const annotation of page.annotations) {
        const pos = annotation.position;
        const style = annotation.style;

        // Convert canvas coordinates to PDF coordinates with proper scaling
        const x = pos.x * scaleX;
        const y = pdfHeight - (pos.y * scaleY); // Simple Y flip (PDF origin is bottom-left)
        const w = pos.width * scaleX;
        const h = pos.height * scaleY;

        console.log(`Annotation ${annotation.type}:`, {
          original: { x: pos.x, y: pos.y, w: pos.width, h: pos.height },
          converted: { x, y, w, h }
        });

        switch (annotation.type) {
          case 'text':
            if (annotation.content) {
              const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
              pdfPage.drawText(annotation.content, {
                x,
                y: y - h, // Adjust for text baseline
                size: style.fontSize || 12,
                font,
                color: this.hexToRgb(style.color),
                opacity: style.opacity
              });
            }
            break;

          case 'highlight':
            pdfPage.drawRectangle({
              x,
              y: y - h, // Adjust Y position for rectangle drawing
              width: w,
              height: h,
              color: this.hexToRgb(style.color),
              opacity: style.opacity * 0.3 // Make highlights semi-transparent
            });
            break;

          case 'rectangle':
            pdfPage.drawRectangle({
              x,
              y: y - h, // Adjust Y position for rectangle drawing
              width: w,
              height: h,
              borderColor: this.hexToRgb(style.color),
              borderWidth: style.strokeWidth || 2,
              color: style.fillColor ? this.hexToRgb(style.fillColor) : undefined,
              opacity: style.opacity
            });
            break;

          case 'circle':
            // Draw ellipse using proper width and height for ellipse support
            // Since PDF-lib doesn't have direct ellipse support, we'll approximate with multiple lines
            const centerX = x + w / 2;
            const centerY = y - h / 2;
            const radiusX = w / 2;
            const radiusY = h / 2;

            // Draw ellipse as a series of lines to support different radiusX and radiusY
            const points = 64; // Increased for smoother ellipses
            for (let i = 0; i < points; i++) {
              const angle1 = (i * 2 * Math.PI) / points;
              const angle2 = ((i + 1) * 2 * Math.PI) / points;

              const x1 = centerX + radiusX * Math.cos(angle1);
              const y1 = centerY + radiusY * Math.sin(angle1);
              const x2 = centerX + radiusX * Math.cos(angle2);
              const y2 = centerY + radiusY * Math.sin(angle2);

              pdfPage.drawLine({
                start: { x: x1, y: y1 },
                end: { x: x2, y: y2 },
                color: this.hexToRgb(style.color),
                thickness: style.strokeWidth || 2,
                opacity: style.opacity
              });
            }
            break;

          case 'line':
            pdfPage.drawLine({
              start: { x, y },
              end: { x: x + w, y: y - h },
              color: this.hexToRgb(style.color),
              thickness: style.strokeWidth || 2,
              opacity: style.opacity
            });
            break;

          case 'arrow':
            // Draw line
            const endX = x + w;
            const endY = y - h;
            pdfPage.drawLine({
              start: { x, y },
              end: { x: endX, y: endY },
              color: this.hexToRgb(style.color),
              thickness: style.strokeWidth || 2,
              opacity: style.opacity
            });

            // Draw arrowhead
            const arrowLength = 10 * scaleX;
            const arrowAngle = Math.PI / 6; // 30 degrees
            const lineAngle = Math.atan2(endY - y, endX - x);

            const arrowPoint1X = endX - arrowLength * Math.cos(lineAngle - arrowAngle);
            const arrowPoint1Y = endY - arrowLength * Math.sin(lineAngle - arrowAngle);
            const arrowPoint2X = endX - arrowLength * Math.cos(lineAngle + arrowAngle);
            const arrowPoint2Y = endY - arrowLength * Math.sin(lineAngle + arrowAngle);

            pdfPage.drawLine({
              start: { x: endX, y: endY },
              end: { x: arrowPoint1X, y: arrowPoint1Y },
              color: this.hexToRgb(style.color),
              thickness: style.strokeWidth || 2,
              opacity: style.opacity
            });

            pdfPage.drawLine({
              start: { x: endX, y: endY },
              end: { x: arrowPoint2X, y: arrowPoint2Y },
              color: this.hexToRgb(style.color),
              thickness: style.strokeWidth || 2,
              opacity: style.opacity
            });
            break;
        }
      }

      const annotatedBytes = await pdfDoc.save();

      return {
        success: true,
        data: annotatedBytes,
        metadata: {
          annotatedPage: page.pageNumber,
          annotationCount: page.annotations.length
        }
      };
    } catch (error) {
      console.error('Failed to apply annotations:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Annotation application failed'
      };
    } finally {
      this.setProcessing('annotate', false);
    }
  }

  /**
   * Apply page modifications (crop, resize, etc.)
   */
  async applyPageModifications(document: PdfDocument, pageId: string): Promise<PdfOperationResult> {
    this.setProcessing('modify', true);

    try {
      const page = document.pages.find(p => p.id === pageId);
      if (!page || page.modifications.length === 0) {
        return { success: true, data: document.currentVersion };
      }

      const pdfDoc = await PDFDocument.load(document.currentVersion);
      const pdfPage = pdfDoc.getPages()[page.pageNumber - 1];

      if (!pdfPage) {
        throw new Error('Page not found in PDF');
      }

      for (const modification of page.modifications.filter(m => m.isActive)) {
        switch (modification.type) {
          case 'crop':
            if (modification.data.cropBox) {
              const { x, y, width, height } = modification.data.cropBox;
              const pageSize = pdfPage.getSize();

              pdfPage.setCropBox(
                x * pageSize.width,
                y * pageSize.height,
                width * pageSize.width,
                height * pageSize.height
              );
            }
            break;

          case 'resize':
            if (modification.data.newDimensions) {
              const newDims = modification.data.newDimensions;
              pdfPage.setSize(newDims.width, newDims.height);
            }
            break;
        }
      }

      const modifiedBytes = await pdfDoc.save();

      return {
        success: true,
        data: modifiedBytes,
        metadata: {
          modifiedPage: page.pageNumber,
          modificationCount: page.modifications.filter(m => m.isActive).length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Page modification failed'
      };
    } finally {
      this.setProcessing('modify', false);
    }
  }

  /**
   * Export pages as images
   */
  async exportAsImages(
    document: PdfDocument,
    config: ExportConfig
  ): Promise<{ images: string[]; zipBlob?: Blob }> {
    this.setProcessing('export', true);

    try {
      const arrayBuffer = document.currentVersion.buffer;
      const pdfjs = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const images: string[] = [];
      const pagesToExport = config.pages || Array.from({ length: document.totalPages }, (_, i) => i + 1);

      for (const pageNum of pagesToExport) {
        const page = await pdfjs.getPage(pageNum);
        const viewport = page.getViewport({ scale: (config.dpi || 150) / 72 });

        const canvas = globalThis.document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // Set background color if specified
        if (config.backgroundColor) {
          context.fillStyle = config.backgroundColor;
          context.fillRect(0, 0, canvas.width, canvas.height);
        }

        await page.render({ canvasContext: context, viewport, canvas }).promise;

        const imageData = canvas.toDataURL(
          config.format === 'png' ? 'image/png' : 'image/jpeg',
          config.quality || 0.9
        );
        images.push(imageData);

        this.setProgress('export', (images.length / pagesToExport.length) * 100);
      }

      // Create ZIP if requested
      let zipBlob: Blob | undefined;
      if (config.format === 'zip') {
        const zip = new JSZip();
        const folderName = config.fileName?.replace('.pdf', '') || document.name.replace('.pdf', '');

        images.forEach((imageData, index) => {
          const pageNum = pagesToExport[index];
          const extension = config.format === 'png' ? 'png' : 'jpg';
          const fileName = `page_${pageNum.toString().padStart(3, '0')}.${extension}`;

          // Convert data URL to blob
          const base64Data = imageData.split(',')[1];
          zip.file(`${folderName}/${fileName}`, base64Data, { base64: true });
        });

        zipBlob = await zip.generateAsync({ type: 'blob' });
      }

      return { images, zipBlob };
    } finally {
      this.setProcessing('export', false);
      this.setProgress('export', 0);
    }
  }

  // Private helper methods
  private async extractMetadata(pdfDoc: PDFDocument, pdfjs: any): Promise<PdfMetadata> {
    const info = await pdfjs.getMetadata();

    return {
      title: info.info.Title || '',
      author: info.info.Author || '',
      subject: info.info.Subject || '',
      keywords: info.info.Keywords ? info.info.Keywords.split(',').map((k: string) => k.trim()) : [],
      creator: info.info.Creator || '',
      producer: info.info.Producer || '',
      creationDate: info.info.CreationDate ? new Date(info.info.CreationDate) : undefined,
      modificationDate: info.info.ModDate ? new Date(info.info.ModDate) : undefined,
      encrypted: info.info.IsAcroFormPresent || false,
      permissions: {
        printing: true,
        modifying: true,
        copying: true,
        annotating: true,
        fillingForms: true,
        extracting: true,
        assembling: true,
        printingHighRes: true
      },
      pdfVersion: info.info.PDFFormatVersion || '1.4'
    };
  }

  private async extractPages(pdfDoc: PDFDocument, pdfjs: any, fileName: string): Promise<PdfPage[]> {
    const pages: PdfPage[] = [];
    const pageCount = pdfDoc.getPageCount();

    for (let i = 0; i < pageCount; i++) {
      const page = await pdfjs.getPage(i + 1);
      const viewport = page.getViewport({ scale: 1 });

      const pdfPage = createPdfPage(
        `${fileName}_page_${i + 1}`,
        '', // Will be set later
        i + 1,
        {
          width: viewport.width,
          height: viewport.height,
          unit: 'pt'
        }
      );

      pages.push(pdfPage);
    }

    return pages;
  }

  private getTotalPagesToMerge(documents: PdfDocument[], config: MergeConfig): number {
    return config.documentIds.reduce((total, docId) => {
      const document = documents.find(d => d.id === docId);
      if (!document) return total;

      const pageRanges = config.pageRanges?.[docId];
      return total + (pageRanges ? pageRanges.length : document.totalPages);
    }, 0);
  }

  private setProcessing(operation: string, processing: boolean): void {
    const current = this.processingSubject.value;
    this.processingSubject.next({ ...current, [operation]: processing });
  }

  private setProgress(operation: string, progress: number): void {
    const current = this.progressSubject.value;
    this.progressSubject.next({ ...current, [operation]: progress });
  }

  private hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
      return rgb(0, 0, 0); // Default to black
    }

    return rgb(
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    );
  }
}
