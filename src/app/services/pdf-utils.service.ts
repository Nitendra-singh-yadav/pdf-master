import { Injectable } from '@angular/core';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

@Injectable({
  providedIn: 'root'
})
export class PdfUtilsService {

  constructor() {
    // Configure PDF.js worker to prevent ArrayBuffer detachment issues
    // Use a proper worker source or disable worker processing
    if (!GlobalWorkerOptions.workerSrc) {
      // Option 1: Use CDN worker (recommended)
      GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

      // Option 2: If you want to disable worker (uncomment below and comment above)
      // GlobalWorkerOptions.workerSrc = false;
    }
  }

  async readPdfFile(file: File): Promise<PDFDocument> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    return pdf;
  }

  async mergePdfs(pdfFiles: File[]): Promise<Uint8Array> {
    const mergedPdf = await PDFDocument.create();

    for (const file of pdfFiles) {
      const pdf = await this.readPdfFile(file);
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      pages.forEach(page => mergedPdf.addPage(page));
    }

    return await mergedPdf.save();
  }

  async splitPdf(file: File, pageRanges: number[][]): Promise<Uint8Array[]> {
    const pdf = await this.readPdfFile(file);
    const results: Uint8Array[] = [];

    for (const range of pageRanges) {
      const newPdf = await PDFDocument.create();
      const pages = await newPdf.copyPages(pdf, range);
      pages.forEach(page => newPdf.addPage(page));
      results.push(await newPdf.save());
    }

    return results;
  }

  async compressPdf(file: File, options: any = { jpegQuality: 0.6, scale: 1.0, mode: 'smart' }): Promise<Uint8Array> {
    try {
      // Handle both old string format and new object format
      let settings: any;
      if (typeof options === 'string') {
        const qualitySettings = {
          low: { jpegQuality: 0.9, scale: 1.0, compressionLevel: 'low', mode: 'smart' },
          medium: { jpegQuality: 0.7, scale: 0.95, compressionLevel: 'medium', mode: 'smart' },
          high: { jpegQuality: 0.5, scale: 0.85, compressionLevel: 'high', mode: 'smart' }
        };
        settings = (qualitySettings as any)[options] || (qualitySettings as any).medium;
      } else {
        // Convert compression slider value to appropriate settings
        const compressionLevel = Math.round((1 - options.jpegQuality) * 100);
        settings = {
          jpegQuality: Math.max(0.3, Math.min(0.95, options.jpegQuality)),
          scale: Math.max(0.7, Math.min(1.0, options.scale)),
          compressionLevel: compressionLevel < 30 ? 'low' : compressionLevel < 70 ? 'medium' : 'high',
          mode: options.mode || 'smart'
        };
      }

      const arrayBuffer = await file.arrayBuffer();

      // Lossless compression mode - only use PDF-native compression
      if (settings.mode === 'lossless') {
        return await this.compressPdfLossless(arrayBuffer, file.size);
      }

      // Aggressive compression mode - always use image-based compression
      if (settings.mode === 'aggressive') {
        return await this.compressPdfAggressive(arrayBuffer, file.size, settings);
      }

      // Smart compression mode - try lossless first, then aggressive if needed
      try {
        const losslessResult = await this.compressPdfLossless(arrayBuffer, file.size);
        const compressionRatio = (file.size - losslessResult.length) / file.size;

        // Use lossless if it achieved good results OR if compression level is low/medium
        if (compressionRatio > 0.15 || settings.compressionLevel === 'low' || settings.compressionLevel === 'medium') {
          console.log(`PDF compressed using lossless method from ${file.size} bytes to ${losslessResult.length} bytes`);
          console.log(`Compression ratio: ${(compressionRatio * 100).toFixed(1)}%`);
          return losslessResult;
        }
      } catch (losslessError) {
        console.log('Lossless compression failed, using aggressive compression:', losslessError);
      }

      // Fall back to aggressive compression for better reduction
      return await this.compressPdfAggressive(arrayBuffer, file.size, settings);

    } catch (error) {
      console.error('Error compressing PDF:', error);
      throw new Error(`Failed to compress PDF: ${error}`);
    }
  }

  private async compressPdfLossless(arrayBuffer: ArrayBuffer, originalSize: number): Promise<Uint8Array> {
    const originalPdf = await PDFDocument.load(arrayBuffer);

    // Remove unnecessary metadata and optimize
    originalPdf.setCreator('PDF Master');
    originalPdf.setProducer('PDF Master Lossless Compressed');
    originalPdf.setSubject('');
    originalPdf.setAuthor('');
    originalPdf.setKeywords([]);

    // Save with maximum PDF compression settings
    const compressed = await originalPdf.save({
      useObjectStreams: true,
      addDefaultPage: false,
      objectsPerTick: 50,
      updateFieldAppearances: false
    });

    return compressed;
  }

  private async compressPdfAggressive(arrayBuffer: ArrayBuffer, originalSize: number, settings: any): Promise<Uint8Array> {
    // Start with native compression as baseline
    let nativeCompressed: Uint8Array;
    try {
      const originalPdf = await PDFDocument.load(arrayBuffer);

      // Remove metadata
      originalPdf.setCreator('');
      originalPdf.setProducer('PDF Master');
      originalPdf.setSubject('');
      originalPdf.setAuthor('');
      originalPdf.setKeywords([]);
      originalPdf.setTitle('');

      nativeCompressed = await originalPdf.save({
        useObjectStreams: true,
        addDefaultPage: false,
        objectsPerTick: 50,
        updateFieldAppearances: false
      });

      const nativeRatio = (originalSize - nativeCompressed.length) / originalSize;
      console.log(`Native compression achieved: ${(nativeRatio * 100).toFixed(1)}% reduction`);

    } catch (error) {
      console.log('Native compression failed:', error);
      nativeCompressed = new Uint8Array(arrayBuffer);
    }

    return nativeCompressed;
  }

  async addWatermark(file: File, text: string, options: any = {}): Promise<{ data: Uint8Array; blob: Blob; url: string }> {
    try {
      console.log('Starting watermark process...');
      const pdf = await this.readPdfFile(file);
      const pages = pdf.getPages();

      const {
        fontSize = 200,
        color = { r: 0.5, g: 0.5, b: 0.5 },
        opacity = 0.3,
        rotation = -45,
        pages: selectedPages = null,
        type = 'text'
      } = options;

      const font = await pdf.embedFont(StandardFonts.HelveticaBold);

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];

        if (selectedPages && !selectedPages.includes(i + 1)) {
          continue;
        }

        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        const textHeight = font.heightAtSize(fontSize);

        if (type === 'text' && text) {
          const x = width / 2;
          const y = height / 2;

          page.drawText(text, {
            x: x - textWidth / 2,
            y: y - textHeight / 2,
            font,
            size: fontSize,
            color: rgb(color.r, color.g, color.b),
            opacity: opacity,
            rotate: {
              type: 'degrees',
              angle: rotation,
              origin: { x: x, y: y }
            } as any
          });
        }
      }

      const pdfBytes = await pdf.save({
        useObjectStreams: false,
        addDefaultPage: false
      });

      const blob = new Blob([pdfBytes], {
        type: 'application/pdf'
      });

      const url = URL.createObjectURL(blob);

      return {
        data: pdfBytes,
        blob,
        url
      };
    } catch (error) {
      console.error('Error in addWatermark:', error);
      throw error;
    }
  }

  async extractPages(file: File, pageNumbers: number[]): Promise<Uint8Array> {
    const pdf = await this.readPdfFile(file);
    const newPdf = await PDFDocument.create();

    const pages = await newPdf.copyPages(pdf, pageNumbers.map(num => num - 1));
    pages.forEach(page => newPdf.addPage(page));

    return await newPdf.save();
  }

  async reorderPages(file: File, newOrder: number[]): Promise<Uint8Array> {
    const pdf = await this.readPdfFile(file);
    const newPdf = await PDFDocument.create();

    const pages = await newPdf.copyPages(pdf, newOrder.map(num => num - 1));
    pages.forEach(page => newPdf.addPage(page));

    return await newPdf.save();
  }

  async deletePage(file: File, pageNumber: number): Promise<Uint8Array> {
    const pdf = await this.readPdfFile(file);
    const totalPages = pdf.getPageCount();
    const newPdf = await PDFDocument.create();

    const pagesToKeep = Array.from({length: totalPages}, (_, i) => i)
      .filter(i => i !== pageNumber - 1);

    const pages = await newPdf.copyPages(pdf, pagesToKeep);
    pages.forEach(page => newPdf.addPage(page));

    return await newPdf.save();
  }

  async rotatePage(file: File, pageNumber: number, angle: number): Promise<Uint8Array> {
    const pdf = await this.readPdfFile(file);
    const page = pdf.getPage(pageNumber - 1);

    page.setRotation({ type: 'degrees', angle } as any);

    return await pdf.save();
  }

  async protectPdf(file: File, userPassword: string, ownerPassword?: string): Promise<Uint8Array> {
    const pdf = await this.readPdfFile(file);

    // Note: PDF protection might need additional implementation in Angular
    // For now, return the original PDF
    console.warn('PDF protection not fully implemented in Angular version');

    return await pdf.save();
  }

  async reorderSelectedPages(orderedPagesData: any[], files: File[]): Promise<Uint8Array> {
    const newPdf = await PDFDocument.create();

    try {
      for (const pageData of orderedPagesData) {
        const { fileIndex, pageNumber } = pageData;
        const sourceFile = files[fileIndex];

        if (!sourceFile) {
          throw new Error(`Source file at index ${fileIndex} not found`);
        }

        const sourcePdf = await this.readPdfFile(sourceFile);
        const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageNumber - 1]);
        newPdf.addPage(copiedPage);
      }

      return await newPdf.save();
    } catch (error) {
      console.error('Error reordering selected pages:', error);
      throw new Error(`Failed to reorder pages: ${error}`);
    }
  }

  async extractPagesWithReorder(file: File, pageNumbers: number[], reorderedPages: any[] | null = null): Promise<Uint8Array> {
    if (reorderedPages && reorderedPages.length > 0) {
      const reorderedExtractPages = reorderedPages.filter(page =>
        pageNumbers.includes(page.pageNumber)
      );

      if (reorderedExtractPages.length > 0) {
        const fileArray = [file];
        return await this.reorderSelectedPages(reorderedExtractPages, fileArray);
      }
    }

    return await this.extractPages(file, pageNumbers);
  }

  async pdfToImages(file: File): Promise<string[]> {
    const data = await file.arrayBuffer();
    const pdf = await getDocument({ data }).promise;
    const images: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 3.0 }); // Increased scale for better quality
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) continue;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: context,
        viewport,
        canvas: canvas
      }).promise;

      images.push(canvas.toDataURL('image/png'));
    }

    return images;
  }

  async renderPageAtHighResolution(file: File, pageNumber: number, scale: number = 3): Promise<{
    imageDataUrl: string;
    width: number;
    height: number;
  }> {
    const data = await file.arrayBuffer();
    const pdf = await getDocument({ data }).promise;
    const page = await pdf.getPage(pageNumber);

    // Use high scale for crisp rendering
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not get canvas context');
    }

    // Enable high-quality rendering
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // Set canvas style for better rendering
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    await page.render({
      canvasContext: context,
      viewport,
      canvas: canvas
    }).promise;

    return {
      imageDataUrl: canvas.toDataURL('image/png', 1.0), // Maximum quality
      width: viewport.width,
      height: viewport.height
    };
  }

  // Enhanced canvas-based rendering method
  async renderPageToCanvas(pdf: any, pageNumber: number, canvas: HTMLCanvasElement, scale: number = 1): Promise<void> {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not get canvas context');
    }

    // Set canvas dimensions
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // Enable high-quality rendering
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    // Render the page
    await page.render({
      canvasContext: context,
      viewport
    }).promise;
  }

  // Optimized method for multiple page rendering
  async renderPagesToCanvases(file: File, startPage: number = 1, endPage?: number, scale: number = 2): Promise<HTMLCanvasElement[]> {
    const data = await file.arrayBuffer();
    const pdf = await getDocument({ data }).promise;
    const totalPages = pdf.numPages;
    const lastPage = endPage || totalPages;
    const canvases: HTMLCanvasElement[] = [];

    for (let pageNum = startPage; pageNum <= Math.min(lastPage, totalPages); pageNum++) {
      const canvas = document.createElement('canvas');
      await this.renderPageToCanvas(pdf, pageNum, canvas, scale);
      canvases.push(canvas);
    }

    return canvases;
  }
}