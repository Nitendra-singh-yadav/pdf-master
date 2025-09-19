import { Component, OnInit, OnDestroy, AfterViewInit, Input, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import {
  PdfDocument,
  PdfPage,
  PageAnnotation,
  AnnotationType,
  AnnotationPosition,
  AnnotationStyle,
  ModificationType,
  PageModification
} from '../models/pdf-document.model';
import { PdfUtilsService } from '../services/pdf-utils.service';

export interface EditTool {
  type: 'select' | 'text' | 'highlight' | 'rectangle' | 'circle' | 'line' | 'arrow' | 'freehand' | 'crop';
  name: string;
  icon: string;
  cursor: string;
}

export interface DrawingState {
  isDrawing: boolean;
  startPoint: { x: number; y: number };
  currentPoint: { x: number; y: number };
  tool: EditTool;
}

@Component({
  selector: 'app-page-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-editor h-full flex flex-col bg-gray-50" *ngIf="page">
      <!-- Editor Toolbar -->
      <div class="editor-toolbar bg-white border-b border-gray-200 p-4 flex-shrink-0 sticky top-0 z-10 shadow-sm">
        <div class="flex items-center justify-between">
          <!-- Tool Selection -->
          <div class="flex items-center space-x-2">
            <button
              *ngFor="let tool of editTools"
              (click)="selectTool(tool)"
              [class.bg-blue-100]="selectedTool?.type === tool.type"
              [class.text-blue-700]="selectedTool?.type === tool.type"
              class="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors flex items-center space-x-1"
              [title]="tool.name"
            >
              <span>{{tool.icon}}</span>
              <span class="hidden md:inline">{{tool.name}}</span>
            </button>
          </div>

          <!-- Style Controls -->
          <div class="flex items-center space-x-3" *ngIf="selectedTool?.type !== 'select' && selectedTool?.type !== 'crop'">
            <!-- Color Picker -->
            <div class="flex items-center space-x-2">
              <label class="text-sm font-medium text-gray-700">Color:</label>
              <input
                type="color"
                [(ngModel)]="currentStyle.color"
                class="w-8 h-8 border border-gray-300 rounded cursor-pointer"
              >
            </div>

            <!-- Stroke Width -->
            <div class="flex items-center space-x-2" *ngIf="needsStroke()">
              <label class="text-sm font-medium text-gray-700">Width:</label>
              <input
                type="range"
                min="1"
                max="10"
                [(ngModel)]="currentStyle.strokeWidth"
                class="w-20"
              >
              <span class="text-xs text-gray-500">{{currentStyle.strokeWidth}}px</span>
            </div>

            <!-- Opacity -->
            <div class="flex items-center space-x-2">
              <label class="text-sm font-medium text-gray-700">Opacity:</label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                [(ngModel)]="currentStyle.opacity"
                class="w-20"
              >
              <span class="text-xs text-gray-500">{{(currentStyle.opacity * 100).toFixed(0)}}%</span>
            </div>

            <!-- Font Size for Text -->
            <div class="flex items-center space-x-2" *ngIf="selectedTool?.type === 'text'">
              <label class="text-sm font-medium text-gray-700">Size:</label>
              <input
                type="number"
                min="8"
                max="72"
                [(ngModel)]="currentStyle.fontSize"
                class="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
              >
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex items-center space-x-2">
            <button
              (click)="clearAnnotations()"
              class="px-3 py-2 text-sm bg-red-100 text-red-700 border border-red-300 rounded hover:bg-red-200 transition-colors flex-shrink-0"
              title="Clear all annotations"
            >
              Clear All
            </button>
            <button
              (click)="saveChanges()"
              class="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex-shrink-0 font-medium"
              [disabled]="drawingState.isDrawing"
              title="Save all changes"
            >
              💾 Save Changes
            </button>
            <button
              (click)="closeEditor()"
              class="px-4 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors flex-shrink-0"
              title="Close editor"
            >
              ✕ Close
            </button>
          </div>
        </div>
      </div>

      <!-- Zoom Controls -->
      <div class="bg-gray-100 border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <span class="text-sm font-medium text-gray-700">Zoom:</span>
          <button
            (click)="zoomOut()"
            [disabled]="zoomLevel <= minZoom"
            class="w-8 h-8 flex items-center justify-center bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            title="Zoom out"
          >
            −
          </button>
          <span class="text-sm text-gray-600 min-w-[60px] text-center">{{(zoomLevel * 100).toFixed(0)}}%</span>
          <button
            (click)="zoomIn()"
            [disabled]="zoomLevel >= maxZoom"
            class="w-8 h-8 flex items-center justify-center bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            title="Zoom in"
          >
            +
          </button>
          <button
            (click)="resetZoom()"
            class="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
            title="Reset zoom"
          >
            Reset
          </button>
        </div>
        <div class="text-sm text-gray-600">
          Use mouse wheel to zoom, hold space + drag to pan
        </div>
      </div>

      <!-- Page Canvas Area -->
      <div class="flex-1 overflow-hidden p-4 bg-gray-100"
           (wheel)="onWheel($event)"
           (keydown)="onKeyDown($event)"
           (keyup)="onKeyUp($event)"
           tabindex="0">
        <div class="max-w-none mx-auto h-full overflow-auto" #scrollContainer>
          <div
            class="relative bg-white shadow-lg mx-auto transform-gpu"
            [style.width.px]="canvasWidth * zoomLevel"
            [style.height.px]="canvasHeight * zoomLevel"
            [style.transform]="'translate(' + panOffset.x + 'px, ' + panOffset.y + 'px)'"
          >
            <!-- Loading Indicator -->
            <div *ngIf="isLoadingHighRes"
                 class="absolute inset-0 bg-gray-100 flex items-center justify-center z-10">
              <div class="flex flex-col items-center space-y-2">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span class="text-sm text-gray-600">Loading high-resolution page...</span>
              </div>
            </div>

            <!-- Page Image -->
            <img
              #pageImage
              [src]="highResPageImage || page.highResThumbnail || page.thumbnail"
              [alt]="'Page ' + page.pageNumber"
              class="w-full h-full"
              style="image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges; image-rendering: pixelated;"
              (load)="onImageLoad()"
              [style.width.px]="canvasWidth * zoomLevel"
              [style.height.px]="canvasHeight * zoomLevel"
              draggable="false"
            >

            <!-- Canvas for Drawing -->
            <canvas
              #drawingCanvas
              [width]="canvasWidth"
              [height]="canvasHeight"
              class="absolute inset-0"
              [style.cursor]="getCursor()"
              [style.width.px]="canvasWidth * zoomLevel"
              [style.height.px]="canvasHeight * zoomLevel"
              (mousedown)="onMouseDown($event)"
              (mousemove)="onMouseMove($event)"
              (mouseup)="onMouseUp($event)"
              (mouseleave)="onMouseLeave($event)"
            ></canvas>

            <!-- Annotation Canvas -->
            <canvas
              #annotationCanvas
              [width]="canvasWidth"
              [height]="canvasHeight"
              class="absolute inset-0 pointer-events-none"
              [style.width.px]="canvasWidth * zoomLevel"
              [style.height.px]="canvasHeight * zoomLevel"
            ></canvas>

            <!-- Text Annotations Only -->
            <div
              *ngFor="let annotation of getTextAnnotations()"
              class="absolute annotation-overlay annotation-text"
              [style.left.px]="annotation.position.x * zoomLevel"
              [style.top.px]="annotation.position.y * zoomLevel"
              [style.width.px]="annotation.position.width * zoomLevel"
              [style.height.px]="annotation.position.height * zoomLevel"
              [style.opacity]="annotation.style.opacity"
            >
              <!-- Text content -->
              <div
                class="p-1 text-sm whitespace-pre-wrap"
                [style.color]="annotation.style.color"
                [style.font-size.px]="(annotation.style.fontSize || 16) * zoomLevel"
                [style.font-family]="annotation.style.fontFamily"
                [style.font-weight]="annotation.style.fontWeight"
                style="background: rgba(255, 255, 255, 0.9); border: 1px dashed rgba(0, 123, 255, 0.5);"
              >
                {{annotation.content}}
              </div>

              <!-- Annotation Controls -->
              <div class="absolute -top-6 -right-6 flex space-x-1 pointer-events-auto">
                <button
                  (click)="editAnnotation(annotation)"
                  class="w-5 h-5 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                  title="Edit"
                >
                  ✎
                </button>
                <button
                  (click)="deleteAnnotation(annotation)"
                  class="w-5 h-5 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                  title="Delete"
                >
                  ×
                </button>
              </div>
            </div>

            <!-- Crop Selection Overlay -->
            <div
              *ngIf="selectedTool?.type === 'crop' && cropSelection"
              class="absolute border-2 border-dashed border-yellow-500 bg-yellow-200 bg-opacity-30"
              [style.left.px]="cropSelection.x * zoomLevel"
              [style.top.px]="cropSelection.y * zoomLevel"
              [style.width.px]="cropSelection.width * zoomLevel"
              [style.height.px]="cropSelection.height * zoomLevel"
            >
              <div class="absolute -top-8 left-0 bg-yellow-500 text-white text-xs px-2 py-1 rounded"
                   [style.transform]="'scale(' + zoomLevel + ')'"
                   [style.transform-origin]="'bottom left'">
                Crop Area: {{(cropSelection.width / zoomLevel).toFixed(0)}}×{{(cropSelection.height / zoomLevel).toFixed(0)}}
              </div>
            </div>
          </div>

          <!-- Page Info -->
          <div class="mt-4 text-center text-sm text-gray-600">
            Page {{page.pageNumber}} • {{page.currentDimensions.width}}×{{page.currentDimensions.height}} {{page.currentDimensions.unit}}
            <span *ngIf="page.annotations.length > 0" class="ml-2">
              • {{page.annotations.length}} annotation(s)
            </span>
          </div>
        </div>
      </div>

      <!-- Text Input Dialog -->
      <div
        *ngIf="showTextDialog"
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        (click)="closeTextDialog()"
      >
        <div
          class="bg-white rounded-lg p-6 max-w-md w-full mx-4"
          (click)="$event.stopPropagation()"
        >
          <h3 class="text-lg font-semibold mb-4">Add Text</h3>
          <textarea
            [(ngModel)]="textInput"
            placeholder="Enter text..."
            rows="4"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            autofocus
          ></textarea>
          <div class="flex justify-end space-x-3 mt-4">
            <button
              (click)="closeTextDialog()"
              class="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              (click)="addTextAnnotation()"
              [disabled]="!textInput.trim()"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Add Text
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-editor {
      min-height: 100vh;
    }

    .editor-toolbar {
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      backdrop-filter: blur(10px);
    }

    canvas {
      image-rendering: crisp-edges;
    }

    .annotation-overlay {
      pointer-events: none;
    }

    .annotation-overlay.editable {
      pointer-events: auto;
    }

    /* Annotation styles */
    .annotation-shape {
      border: 2px solid;
    }

    .annotation-text {
      border: 1px dashed rgba(0, 123, 255, 0.5);
      background: rgba(255, 255, 255, 0.9);
    }

    .annotation-freehand {
      border: none;
      background: transparent;
    }

    /* Ensure toolbar stays visible */
    .editor-toolbar {
      position: sticky;
      top: 0;
      z-index: 100;
    }

    /* Improve button visibility */
    button[disabled] {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Success notification */
    .save-success {
      animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `]
})
export class PageEditorComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() page!: PdfPage;
  @Input() document!: PdfDocument;
  @Output() pageUpdated = new EventEmitter<PdfPage>();
  @Output() editorClosed = new EventEmitter<void>();

  @ViewChild('drawingCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('pageImage', { static: false }) imageRef!: ElementRef<HTMLImageElement>;
  @ViewChild('scrollContainer', { static: false }) scrollContainerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('annotationCanvas', { static: false }) annotationCanvasRef!: ElementRef<HTMLCanvasElement>;

  // Editor state
  selectedTool: EditTool | null = null;
  drawingState: DrawingState = {
    isDrawing: false,
    startPoint: { x: 0, y: 0 },
    currentPoint: { x: 0, y: 0 },
    tool: { type: 'select', name: 'Select', icon: '👆', cursor: 'default' }
  };

  // Canvas properties
  canvasWidth = 800;
  canvasHeight = 1000;
  canvasContext: CanvasRenderingContext2D | null = null;
  annotationContext: CanvasRenderingContext2D | null = null;

  // High-resolution page rendering
  highResPageImage: string | null = null;
  isLoadingHighRes = false;

  // Style configuration
  currentStyle: AnnotationStyle = {
    color: '#FF0000',
    fillColor: '',
    strokeWidth: 2,
    opacity: 1,
    fontSize: 16,
    fontFamily: 'Arial',
    fontWeight: 'normal'
  };

  // Text annotation
  showTextDialog = false;
  textInput = '';
  pendingTextPosition: { x: number; y: number } | null = null;

  // Crop selection
  cropSelection: { x: number; y: number; width: number; height: number } | null = null;

  // Zoom and pan functionality
  zoomLevel = 1;
  minZoom = 0.25;
  maxZoom = 3;
  panOffset = { x: 0, y: 0 };
  isPanning = false;
  lastPanPoint = { x: 0, y: 0 };

  editTools: EditTool[] = [
    { type: 'select', name: 'Select', icon: '👆', cursor: 'default' },
    { type: 'text', name: 'Text', icon: 'T', cursor: 'text' },
    { type: 'highlight', name: 'Highlight', icon: '🖍️', cursor: 'crosshair' },
    { type: 'rectangle', name: 'Rectangle', icon: '⬜', cursor: 'crosshair' },
    { type: 'circle', name: 'Circle', icon: '⭕', cursor: 'crosshair' },
    { type: 'line', name: 'Line', icon: '📏', cursor: 'crosshair' },
    { type: 'arrow', name: 'Arrow', icon: '➡️', cursor: 'crosshair' },
    { type: 'freehand', name: 'Draw', icon: '✏️', cursor: 'crosshair' },
    { type: 'crop', name: 'Crop', icon: '✂️', cursor: 'crosshair' }
  ];

  private destroy$ = new Subject<void>();

  constructor(private pdfUtilsService: PdfUtilsService) {}

  ngOnInit(): void {
    this.selectedTool = this.editTools[0]; // Select tool by default
    this.calculateCanvasSize();
    this.loadHighResolutionPage();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initAnnotationCanvas();
      this.renderAllAnnotations();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Tool selection
  selectTool(tool: EditTool): void {
    this.selectedTool = tool;
    this.drawingState.tool = tool;
  }

  needsStroke(): boolean {
    return this.selectedTool?.type !== 'text' && this.selectedTool?.type !== 'highlight';
  }

  // Canvas events
  onMouseDown(event: MouseEvent): void {
    if (!this.selectedTool || !this.canvasRef) return;

    // Check if ctrl/cmd key is pressed for panning
    if (event.ctrlKey || event.metaKey) {
      this.isPanning = true;
      this.lastPanPoint = { x: event.clientX, y: event.clientY };
      return;
    }

    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = (event.clientX - rect.left) / this.zoomLevel;
    const y = (event.clientY - rect.top) / this.zoomLevel;

    this.drawingState.isDrawing = true;
    this.drawingState.startPoint = { x, y };
    this.drawingState.currentPoint = { x, y };

    if (this.selectedTool.type === 'text') {
      this.pendingTextPosition = { x, y };
      this.showTextDialog = true;
      this.drawingState.isDrawing = false; // Don't draw while text dialog is open
    } else {
      this.initCanvas();
      if (this.selectedTool.type === 'freehand') {
        this.canvasContext!.beginPath();
        this.canvasContext!.moveTo(x, y);
      }
    }
  }

  onMouseMove(event: MouseEvent): void {
    // Handle panning
    if (this.isPanning) {
      const deltaX = event.clientX - this.lastPanPoint.x;
      const deltaY = event.clientY - this.lastPanPoint.y;
      this.panOffset.x += deltaX;
      this.panOffset.y += deltaY;
      this.lastPanPoint = { x: event.clientX, y: event.clientY };
      return;
    }

    if (!this.drawingState.isDrawing || !this.selectedTool || !this.canvasRef) return;

    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = (event.clientX - rect.left) / this.zoomLevel;
    const y = (event.clientY - rect.top) / this.zoomLevel;

    this.drawingState.currentPoint = { x, y };

    // Use requestAnimationFrame for smoother drawing
    requestAnimationFrame(() => {
      if (this.selectedTool!.type === 'freehand') {
        this.drawFreehand(x, y);
      } else if (this.selectedTool!.type === 'crop') {
        this.updateCropSelection();
      } else {
        this.previewShape();
      }
    });
  }

  onMouseUp(event: MouseEvent): void {
    if (this.isPanning) {
      this.isPanning = false;
      return;
    }

    if (!this.drawingState.isDrawing || !this.selectedTool) return;

    const rect = this.canvasRef?.nativeElement.getBoundingClientRect();
    if (rect) {
      const x = (event.clientX - rect.left) / this.zoomLevel;
      const y = (event.clientY - rect.top) / this.zoomLevel;
      this.drawingState.currentPoint = { x, y };
    }

    if (this.selectedTool.type === 'freehand') {
      this.createFreehandAnnotation();
    } else if (this.selectedTool.type !== 'text') {
      this.createAnnotation();
    }

    if (this.selectedTool.type === 'crop' && this.cropSelection) {
      this.applyCrop();
    }

    this.drawingState.isDrawing = false;
    this.clearCanvas(); // Clear the preview canvas
  }

  onMouseLeave(event: MouseEvent): void {
    if (this.drawingState.isDrawing && this.selectedTool?.type === 'freehand') {
      // Complete freehand drawing if mouse leaves canvas
      this.createFreehandAnnotation();
    }
    this.drawingState.isDrawing = false;
    this.clearCanvas();
  }

  // Canvas drawing methods
  private initCanvas(): void {
    if (!this.canvasRef) return;
    this.canvasContext = this.canvasRef.nativeElement.getContext('2d');
    if (this.canvasContext) {
      this.canvasContext.strokeStyle = this.currentStyle.color;
      this.canvasContext.fillStyle = this.currentStyle.fillColor || this.currentStyle.color;
      this.canvasContext.lineWidth = this.currentStyle.strokeWidth;
      this.canvasContext.globalAlpha = this.currentStyle.opacity;
      this.canvasContext.lineCap = 'round';
      this.canvasContext.lineJoin = 'round';
      // Enable smooth lines
      this.canvasContext.imageSmoothingEnabled = true;
    }
  }

  private previewShape(): void {
    if (!this.canvasContext) this.initCanvas();

    // Clear canvas and redraw
    this.clearCanvas();
    this.drawShape(true);
  }

  private drawShape(isPreview = false): void {
    if (!this.canvasContext) return;

    const { startPoint, currentPoint } = this.drawingState;
    const width = currentPoint.x - startPoint.x;
    const height = currentPoint.y - startPoint.y;

    this.canvasContext.strokeStyle = this.currentStyle.color;
    this.canvasContext.fillStyle = this.currentStyle.fillColor || 'transparent';
    this.canvasContext.lineWidth = this.currentStyle.strokeWidth;

    switch (this.selectedTool?.type) {
      case 'rectangle':
        this.canvasContext.strokeRect(startPoint.x, startPoint.y, width, height);
        if (this.currentStyle.fillColor) {
          this.canvasContext.fillRect(startPoint.x, startPoint.y, width, height);
        }
        break;

      case 'circle':
        // Draw ellipse using the actual width and height for proper ellipse support
        const centerX = startPoint.x + width / 2;
        const centerY = startPoint.y + height / 2;
        const radiusX = Math.abs(width) / 2;
        const radiusY = Math.abs(height) / 2;
        this.canvasContext.beginPath();
        this.canvasContext.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        if (this.currentStyle.fillColor) {
          this.canvasContext.fill();
        }
        this.canvasContext.stroke();
        break;

      case 'line':
        this.canvasContext.beginPath();
        this.canvasContext.moveTo(startPoint.x, startPoint.y);
        this.canvasContext.lineTo(currentPoint.x, currentPoint.y);
        this.canvasContext.stroke();
        break;

      case 'arrow':
        this.drawArrow(startPoint, currentPoint);
        break;

      case 'highlight':
        this.canvasContext.fillStyle = this.currentStyle.color + '40'; // Add transparency
        this.canvasContext.fillRect(startPoint.x, startPoint.y, width, height);
        break;
    }
  }

  private drawArrow(start: { x: number; y: number }, end: { x: number; y: number }): void {
    if (!this.canvasContext) return;

    const headLength = 15;
    const angle = Math.atan2(end.y - start.y, end.x - start.x);

    // Draw line
    this.canvasContext.beginPath();
    this.canvasContext.moveTo(start.x, start.y);
    this.canvasContext.lineTo(end.x, end.y);
    this.canvasContext.stroke();

    // Draw arrowhead
    this.canvasContext.beginPath();
    this.canvasContext.moveTo(end.x, end.y);
    this.canvasContext.lineTo(
      end.x - headLength * Math.cos(angle - Math.PI / 6),
      end.y - headLength * Math.sin(angle - Math.PI / 6)
    );
    this.canvasContext.moveTo(end.x, end.y);
    this.canvasContext.lineTo(
      end.x - headLength * Math.cos(angle + Math.PI / 6),
      end.y - headLength * Math.sin(angle + Math.PI / 6)
    );
    this.canvasContext.stroke();
  }

  private drawFreehand(x: number, y: number): void {
    if (!this.canvasContext) return;
    this.canvasContext.lineTo(x, y);
    this.canvasContext.stroke();
    this.canvasContext.beginPath();
    this.canvasContext.moveTo(x, y);
  }

  private clearCanvas(): void {
    if (!this.canvasContext) return;
    this.canvasContext.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
  }

  // Annotation management
  private createAnnotation(): void {
    const { startPoint, currentPoint } = this.drawingState;
    const width = Math.abs(currentPoint.x - startPoint.x);
    const height = Math.abs(currentPoint.y - startPoint.y);

    if (width < 5 || height < 5) return; // Ignore very small annotations

    const annotation: PageAnnotation = {
      id: `annotation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: this.selectedTool!.type as AnnotationType,
      position: {
        x: Math.min(startPoint.x, currentPoint.x),
        y: Math.min(startPoint.y, currentPoint.y),
        width,
        height,
        page: this.page.pageNumber
      },
      style: { ...this.currentStyle },
      timestamp: new Date()
    };

    this.page.annotations.push(annotation);
    this.clearCanvas();
    this.renderAllAnnotations();
    console.log('Annotation created:', annotation);
  }

  private createFreehandAnnotation(): void {
    // For freehand, capture the canvas as image data
    if (!this.canvasContext || !this.canvasRef) return;

    const canvas = this.canvasRef.nativeElement;
    const imageData = canvas.toDataURL();

    const annotation: PageAnnotation = {
      id: `annotation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'freehand',
      position: {
        x: 0,
        y: 0,
        width: this.canvasWidth,
        height: this.canvasHeight,
        page: this.page.pageNumber
      },
      style: { ...this.currentStyle },
      content: imageData,
      timestamp: new Date()
    };

    this.page.annotations.push(annotation);
    this.renderAllAnnotations();
    console.log('Freehand annotation created');
  }

  addTextAnnotation(): void {
    if (!this.textInput.trim() || !this.pendingTextPosition) return;

    const annotation: PageAnnotation = {
      id: `annotation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'text',
      position: {
        x: this.pendingTextPosition.x,
        y: this.pendingTextPosition.y,
        width: this.textInput.length * (this.currentStyle.fontSize || 16) * 0.6,
        height: this.currentStyle.fontSize || 16,
        page: this.page.pageNumber
      },
      style: { ...this.currentStyle },
      content: this.textInput,
      timestamp: new Date()
    };

    this.page.annotations.push(annotation);
    this.closeTextDialog();
    this.renderAllAnnotations();
  }

  editAnnotation(annotation: PageAnnotation): void {
    if (annotation.type === 'text') {
      this.textInput = annotation.content || '';
      this.pendingTextPosition = { x: annotation.position.x, y: annotation.position.y };
      this.showTextDialog = true;
      // Remove the old annotation when editing
      this.deleteAnnotation(annotation);
    }
  }

  deleteAnnotation(annotation: PageAnnotation): void {
    const index = this.page.annotations.findIndex(a => a.id === annotation.id);
    if (index !== -1) {
      this.page.annotations.splice(index, 1);
      this.renderAllAnnotations();
    }
  }

  clearAnnotations(): void {
    if (confirm('Clear all annotations on this page?')) {
      this.page.annotations = [];
      this.clearCanvas();
      this.renderAllAnnotations();
    }
  }

  // Crop functionality
  private updateCropSelection(): void {
    const { startPoint, currentPoint } = this.drawingState;
    this.cropSelection = {
      x: Math.min(startPoint.x, currentPoint.x),
      y: Math.min(startPoint.y, currentPoint.y),
      width: Math.abs(currentPoint.x - startPoint.x),
      height: Math.abs(currentPoint.y - startPoint.y)
    };
  }

  private applyCrop(): void {
    if (!this.cropSelection) return;

    // Add crop modification to page
    const cropModification: PageModification = {
      id: `crop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'crop',
      data: {
        cropBox: {
          x: this.cropSelection.x / this.canvasWidth,
          y: this.cropSelection.y / this.canvasHeight,
          width: this.cropSelection.width / this.canvasWidth,
          height: this.cropSelection.height / this.canvasHeight
        }
      },
      timestamp: new Date(),
      isActive: true
    };

    this.page.modifications.push(cropModification);
    this.cropSelection = null;
  }

  // Dialog management
  closeTextDialog(): void {
    this.showTextDialog = false;
    this.textInput = '';
    this.pendingTextPosition = null;
  }

  // Image and canvas sizing
  onImageLoad(): void {
    this.calculateCanvasSize();
    setTimeout(() => {
      this.initAnnotationCanvas();
      this.renderAllAnnotations();
    }, 100);
  }

  private calculateCanvasSize(): void {
    if (this.imageRef?.nativeElement) {
      const img = this.imageRef.nativeElement;
      this.canvasWidth = img.naturalWidth || img.clientWidth;
      this.canvasHeight = img.naturalHeight || img.clientHeight;

      // Update page dimensions for coordinate conversion
      if (!this.page.originalDimensions) {
        this.page.originalDimensions = {
          width: this.canvasWidth,
          height: this.canvasHeight,
          unit: 'px'
        };
      }

      // Update current dimensions
      this.page.currentDimensions = {
        width: this.canvasWidth,
        height: this.canvasHeight,
        unit: 'px'
      };

      console.log('Canvas size calculated:', {
        canvasWidth: this.canvasWidth,
        canvasHeight: this.canvasHeight,
        originalDimensions: this.page.originalDimensions,
        currentDimensions: this.page.currentDimensions
      });
    }
  }

  // Component actions
  saveChanges(): void {
    // Ensure all temporary drawing states are cleared
    this.clearCanvas();
    this.drawingState.isDrawing = false;

    // Trigger page update
    this.pageUpdated.emit(this.page);

    console.log('Changes saved. Annotations:', this.page.annotations.length);

    // Show success feedback
    this.showSaveSuccess();
  }

  private showSaveSuccess(): void {
    // Create a temporary success indicator
    const successElement = document.createElement('div');
    successElement.textContent = '✓ Changes saved successfully';
    successElement.className = 'fixed top-20 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity';
    document.body.appendChild(successElement);

    setTimeout(() => {
      successElement.style.opacity = '0';
      setTimeout(() => document.body.removeChild(successElement), 300);
    }, 2000);
  }

  closeEditor(): void {
    this.editorClosed.emit();
  }

  // Helper methods for annotation rendering
  getAnnotationBackground(annotation: PageAnnotation): string {
    switch (annotation.type) {
      case 'highlight':
        return annotation.style.color + '40'; // Add transparency
      case 'rectangle':
      case 'circle':
        return annotation.style.fillColor || 'transparent';
      case 'text':
        return 'rgba(255, 255, 255, 0.9)';
      default:
        return 'transparent';
    }
  }

  getAnnotationBorder(annotation: PageAnnotation): string {
    switch (annotation.type) {
      case 'rectangle':
      case 'circle':
      case 'line':
      case 'arrow':
        return `${annotation.style.strokeWidth || 2}px solid ${annotation.style.color}`;
      case 'text':
        return '1px dashed rgba(0, 123, 255, 0.5)';
      case 'highlight':
        return 'none';
      default:
        return '1px solid rgba(0, 123, 255, 0.5)';
    }
  }

  // Zoom and pan methods
  zoomIn(): void {
    if (this.zoomLevel < this.maxZoom) {
      this.zoomLevel = Math.min(this.maxZoom, this.zoomLevel * 1.25);
    }
  }

  zoomOut(): void {
    if (this.zoomLevel > this.minZoom) {
      this.zoomLevel = Math.max(this.minZoom, this.zoomLevel / 1.25);
    }
  }

  resetZoom(): void {
    this.zoomLevel = 1;
    this.panOffset = { x: 0, y: 0 };
  }

  onWheel(event: WheelEvent): void {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();

      const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = this.zoomLevel * zoomFactor;

      if (newZoom >= this.minZoom && newZoom <= this.maxZoom) {
        this.zoomLevel = newZoom;
      }
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.code === 'Space' && !this.drawingState.isDrawing) {
      event.preventDefault();
    }
  }

  onKeyUp(event: KeyboardEvent): void {
    // Handle key releases if needed
  }

  getCursor(): string {
    if (this.isPanning) {
      return 'grabbing';
    }
    return this.selectedTool?.cursor || 'default';
  }

  // Annotation canvas methods
  getTextAnnotations(): PageAnnotation[] {
    return this.page.annotations.filter(a => a.type === 'text');
  }

  initAnnotationCanvas(): void {
    if (!this.annotationCanvasRef) return;
    this.annotationContext = this.annotationCanvasRef.nativeElement.getContext('2d');
    if (this.annotationContext) {
      this.annotationContext.imageSmoothingEnabled = true;
      this.annotationContext.lineCap = 'round';
      this.annotationContext.lineJoin = 'round';
    }
  }

  renderAllAnnotations(): void {
    if (!this.annotationContext) return;

    // Clear the annotation canvas
    this.annotationContext.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Render each annotation
    for (const annotation of this.page.annotations) {
      if (annotation.type !== 'text') {
        this.renderAnnotationOnCanvas(annotation);
      }
    }
  }

  private renderAnnotationOnCanvas(annotation: PageAnnotation): void {
    if (!this.annotationContext) return;

    const { position, style, type } = annotation;

    // Set style properties
    this.annotationContext.strokeStyle = style.color;
    this.annotationContext.fillStyle = style.fillColor || style.color;
    this.annotationContext.lineWidth = style.strokeWidth || 2;
    this.annotationContext.globalAlpha = style.opacity || 1;

    switch (type) {
      case 'rectangle':
        this.annotationContext.strokeRect(position.x, position.y, position.width, position.height);
        if (style.fillColor) {
          this.annotationContext.fillRect(position.x, position.y, position.width, position.height);
        }
        break;

      case 'circle':
        const centerX = position.x + position.width / 2;
        const centerY = position.y + position.height / 2;
        const radiusX = position.width / 2;
        const radiusY = position.height / 2;
        this.annotationContext.beginPath();
        this.annotationContext.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        if (style.fillColor) {
          this.annotationContext.fill();
        }
        this.annotationContext.stroke();
        break;

      case 'line':
        this.annotationContext.beginPath();
        this.annotationContext.moveTo(position.x, position.y);
        this.annotationContext.lineTo(position.x + position.width, position.y + position.height);
        this.annotationContext.stroke();
        break;

      case 'arrow':
        this.renderArrowOnCanvas(
          { x: position.x, y: position.y },
          { x: position.x + position.width, y: position.y + position.height }
        );
        break;

      case 'highlight':
        this.annotationContext.fillStyle = style.color + '40'; // Add transparency
        this.annotationContext.fillRect(position.x, position.y, position.width, position.height);
        break;

      case 'freehand':
        if (annotation.content) {
          const img = new Image();
          img.onload = () => {
            this.annotationContext!.drawImage(img, position.x, position.y, position.width, position.height);
          };
          img.src = annotation.content;
        }
        break;
    }

    // Reset global alpha
    this.annotationContext.globalAlpha = 1;
  }

  private renderArrowOnCanvas(start: { x: number; y: number }, end: { x: number; y: number }): void {
    if (!this.annotationContext) return;

    const headLength = 15;
    const angle = Math.atan2(end.y - start.y, end.x - start.x);

    // Draw line
    this.annotationContext.beginPath();
    this.annotationContext.moveTo(start.x, start.y);
    this.annotationContext.lineTo(end.x, end.y);
    this.annotationContext.stroke();

    // Draw arrowhead
    this.annotationContext.beginPath();
    this.annotationContext.moveTo(end.x, end.y);
    this.annotationContext.lineTo(
      end.x - headLength * Math.cos(angle - Math.PI / 6),
      end.y - headLength * Math.sin(angle - Math.PI / 6)
    );
    this.annotationContext.moveTo(end.x, end.y);
    this.annotationContext.lineTo(
      end.x - headLength * Math.cos(angle + Math.PI / 6),
      end.y - headLength * Math.sin(angle + Math.PI / 6)
    );
    this.annotationContext.stroke();
  }

  // High-resolution page loading
  async loadHighResolutionPage(): Promise<void> {
    if (!this.document?.originalFile || !this.page) {
      console.warn('No original file available for high-resolution rendering');
      return;
    }

    try {
      this.isLoadingHighRes = true;
      console.log(`Loading high-resolution page ${this.page.pageNumber}...`);

      const result = await this.pdfUtilsService.renderPageAtHighResolution(
        this.document.originalFile,
        this.page.pageNumber,
        4 // High scale for crisp rendering
      );

      this.highResPageImage = result.imageDataUrl;

      // Update canvas dimensions to match the high-res image
      this.canvasWidth = result.width / 4; // Divide by scale to get actual size
      this.canvasHeight = result.height / 4;

      console.log(`High-resolution page loaded: ${result.width}x${result.height}`);

      // Re-initialize canvases with new dimensions
      setTimeout(() => {
        this.initAnnotationCanvas();
        this.renderAllAnnotations();
      }, 100);

    } catch (error) {
      console.error('Failed to load high-resolution page:', error);
      // Fall back to original thumbnails
      this.highResPageImage = null;
    } finally {
      this.isLoadingHighRes = false;
    }
  }
}