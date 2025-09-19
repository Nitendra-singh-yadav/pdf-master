/// <reference lib="webworker" />

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker path for Web Worker context
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.149/build/pdf.worker.min.mjs';

export interface WorkerMessage {
  id: string;
  type: string;
  data: any;
}

export interface WorkerResponse {
  id: string;
  type: string;
  success: boolean;
  data?: any;
  error?: string;
  progress?: number;
}

export interface ThumbnailTask {
  pdfData: number[] | ArrayBuffer;
  pageNumber: number;
  width: number;
  quality: number;
}

export interface CompressTask {
  pdfData: ArrayBuffer;
  quality: 'low' | 'medium' | 'high' | 'custom';
  customQuality?: number;
  removeMetadata: boolean;
}

export interface MergeTask {
  documents: Array<{
    data: ArrayBuffer;
    pageRanges?: number[];
  }>;
  outputName: string;
  includeMetadata: boolean;
}

export interface SplitTask {
  pdfData: ArrayBuffer;
  method: 'pages' | 'range';
  pages?: number[];
  ranges?: Array<{ start: number; end: number }>;
}

export interface AnnotationTask {
  pdfData: ArrayBuffer;
  pageNumber: number;
  annotations: Array<{
    type: string;
    position: { x: number; y: number; width: number; height: number };
    style: any;
    content?: string;
  }>;
  pageDimensions: { width: number; height: number };
}

class PDFWorker {
  private pendingTasks = new Map<string, any>();

  constructor() {
    self.addEventListener('message', this.handleMessage.bind(this));
  }

  private async handleMessage(event: MessageEvent<WorkerMessage>): Promise<void> {
    const { id, type, data } = event.data;

    try {
      let result: any;

      switch (type) {
        case 'generateThumbnail':
          result = await this.generateThumbnail(data as ThumbnailTask);
          break;

        case 'compressPdf':
          result = await this.compressPdf(data as CompressTask);
          break;

        case 'mergePdfs':
          result = await this.mergePdfs(data as MergeTask);
          break;

        case 'splitPdf':
          result = await this.splitPdf(data as SplitTask);
          break;

        case 'applyAnnotations':
          result = await this.applyAnnotations(data as AnnotationTask);
          break;

        case 'extractMetadata':
          result = await this.extractMetadata(data.pdfData);
          break;

        case 'rotatePage':
          result = await this.rotatePage(data.pdfData, data.pageNumber, data.angle);
          break;

        default:
          throw new Error(`Unknown task type: ${type}`);
      }

      this.sendResponse({
        id,
        type,
        success: true,
        data: result
      });

    } catch (error) {
      this.sendResponse({
        id,
        type,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }

  private async generateThumbnail(task: ThumbnailTask): Promise<string> {
    const { pdfData, pageNumber, width, quality } = task;

    // Convert array back to ArrayBuffer if needed
    const arrayBuffer = Array.isArray(pdfData) ? new Uint8Array(pdfData).buffer : pdfData;

    // Load PDF with PDF.js
    const pdfjs = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdfjs.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });

    // Calculate scale to achieve desired width
    const scale = width / viewport.width;
    const scaledViewport = page.getViewport({ scale });

    // Create offscreen canvas
    const canvas = new OffscreenCanvas(scaledViewport.width, scaledViewport.height);
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not create canvas context');
    }

    // Render page
    const renderContext = {
      canvasContext: context as any,
      viewport: scaledViewport
    };

    await page.render(renderContext).promise;

    // Convert to blob and then to base64
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Convert to base64
    let binary = '';
    for (let i = 0; i < uint8Array.byteLength; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }

    return `data:image/jpeg;base64,${btoa(binary)}`;
  }

  private async compressPdf(task: CompressTask): Promise<ArrayBuffer> {
    const { pdfData, quality, customQuality, removeMetadata } = task;

    const pdfDoc = await PDFDocument.load(pdfData);

    // Remove metadata if requested
    if (removeMetadata) {
      pdfDoc.setTitle('');
      pdfDoc.setAuthor('');
      pdfDoc.setSubject('');
      pdfDoc.setKeywords([]);
      pdfDoc.setProducer('');
      pdfDoc.setCreator('');
    }

    // Determine compression settings
    let compressionLevel = 50;
    switch (quality) {
      case 'low': compressionLevel = 30; break;
      case 'medium': compressionLevel = 50; break;
      case 'high': compressionLevel = 80; break;
      case 'custom': compressionLevel = customQuality || 50; break;
    }

    // Save with compression options
    const compressedBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
      objectsPerTick: Math.floor(compressionLevel / 10) + 1
    });

    return compressedBytes.buffer;
  }

  private async mergePdfs(task: MergeTask): Promise<ArrayBuffer> {
    const { documents, outputName, includeMetadata } = task;

    const mergedPdf = await PDFDocument.create();

    let totalPages = 0;
    for (const doc of documents) {
      const sourcePdf = await PDFDocument.load(doc.data);
      const pageCount = sourcePdf.getPageCount();

      const pageIndices = doc.pageRanges || Array.from({ length: pageCount }, (_, i) => i);

      const copiedPages = await mergedPdf.copyPages(sourcePdf, pageIndices);
      copiedPages.forEach(page => mergedPdf.addPage(page));

      totalPages += copiedPages.length;

      // Send progress update
      this.sendProgress(task as any, (totalPages / this.calculateTotalPages(documents)) * 100);
    }

    if (includeMetadata) {
      mergedPdf.setTitle(outputName);
      mergedPdf.setCreationDate(new Date());
      mergedPdf.setModificationDate(new Date());
    }

    const mergedBytes = await mergedPdf.save();
    return mergedBytes.buffer;
  }

  private async splitPdf(task: SplitTask): Promise<ArrayBuffer[]> {
    const { pdfData, method, pages, ranges } = task;

    const sourcePdf = await PDFDocument.load(pdfData);
    const results: ArrayBuffer[] = [];

    if (method === 'pages' && pages) {
      // Split at specific pages
      const splitPoints = [0, ...pages, sourcePdf.getPageCount()];

      for (let i = 0; i < splitPoints.length - 1; i++) {
        const start = splitPoints[i];
        const end = splitPoints[i + 1] - 1;

        if (start <= end) {
          const newPdf = await PDFDocument.create();
          const pageRange = Array.from({ length: end - start + 1 }, (_, idx) => start + idx);
          const copiedPages = await newPdf.copyPages(sourcePdf, pageRange);
          copiedPages.forEach(page => newPdf.addPage(page));

          const pdfBytes = await newPdf.save();
          results.push(pdfBytes.buffer);
        }

        // Send progress update
        this.sendProgress(task as any, ((i + 1) / (splitPoints.length - 1)) * 100);
      }
    } else if (method === 'range' && ranges) {
      // Split by ranges
      for (let i = 0; i < ranges.length; i++) {
        const range = ranges[i];
        const newPdf = await PDFDocument.create();
        const pageRange = Array.from(
          { length: range.end - range.start + 1 },
          (_, idx) => range.start - 1 + idx
        );
        const copiedPages = await newPdf.copyPages(sourcePdf, pageRange);
        copiedPages.forEach(page => newPdf.addPage(page));

        const pdfBytes = await newPdf.save();
        results.push(pdfBytes.buffer);

        // Send progress update
        this.sendProgress(task as any, ((i + 1) / ranges.length) * 100);
      }
    }

    return results;
  }

  private async applyAnnotations(task: AnnotationTask): Promise<ArrayBuffer> {
    const { pdfData, pageNumber, annotations, pageDimensions } = task;

    const pdfDoc = await PDFDocument.load(pdfData);
    const pdfPage = pdfDoc.getPages()[pageNumber - 1];

    if (!pdfPage) {
      throw new Error('Page not found in PDF');
    }

    const { width, height } = pdfPage.getSize();

    for (let i = 0; i < annotations.length; i++) {
      const annotation = annotations[i];
      const pos = annotation.position;
      const style = annotation.style;

      // Convert relative positions to absolute PDF coordinates
      const x = (pos.x / pageDimensions.width) * width;
      const y = height - (pos.y / pageDimensions.height) * height;
      const w = (pos.width / pageDimensions.width) * width;
      const h = (pos.height / pageDimensions.height) * height;

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
            borderWidth: style.strokeWidth,
            opacity: style.opacity
          });
          break;

        case 'line':
          pdfPage.drawLine({
            start: { x, y },
            end: { x: x + w, y: y - h },
            color: this.hexToRgb(style.color),
            thickness: style.strokeWidth,
            opacity: style.opacity
          });
          break;
      }

      // Send progress update
      this.sendProgress(task as any, ((i + 1) / annotations.length) * 100);
    }

    const annotatedBytes = await pdfDoc.save();
    return annotatedBytes.buffer;
  }

  private async extractMetadata(pdfData: ArrayBuffer): Promise<any> {
    const pdfjs = await pdfjsLib.getDocument({ data: pdfData }).promise;
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
      pdfVersion: info.info.PDFFormatVersion || '1.4',
      pageCount: pdfjs.numPages
    };
  }

  private async rotatePage(pdfData: ArrayBuffer, pageNumber: number, angle: number): Promise<ArrayBuffer> {
    const pdfDoc = await PDFDocument.load(pdfData);
    const pages = pdfDoc.getPages();

    if (pageNumber > 0 && pageNumber <= pages.length) {
      const page = pages[pageNumber - 1];
      page.setRotation({ angle });
    }

    const rotatedBytes = await pdfDoc.save();
    return rotatedBytes.buffer;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
      return { r: 0, g: 0, b: 0 };
    }

    return {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255
    };
  }

  private calculateTotalPages(documents: any[]): number {
    return documents.reduce((total, doc) => {
      return total + (doc.pageRanges ? doc.pageRanges.length : doc.pageCount || 0);
    }, 0);
  }

  private sendResponse(response: WorkerResponse): void {
    self.postMessage(response);
  }

  private sendProgress(task: any, progress: number): void {
    self.postMessage({
      id: task.id,
      type: 'progress',
      success: true,
      progress
    });
  }
}

// Initialize the worker
new PDFWorker();