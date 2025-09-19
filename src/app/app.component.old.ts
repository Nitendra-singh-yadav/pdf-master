import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { PdfStateService, PdfState } from './services/pdf-state.service';
import { SnapshotService } from './services/snapshot.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet],
  template: `
    <div class="min-h-screen flex flex-col bg-gray-50 text-gray-900" [class.dark]="darkMode">
      <!-- Header -->
      <header class="bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between items-center h-20">
            <!-- Logo -->
            <div class="flex items-center">
              <div class="flex-shrink-0 flex items-center">
                <div class="w-10 h-10 bg-white rounded-lg flex items-center justify-center mr-3 shadow-md">
                  <span class="text-2xl">📄</span>
                </div>
                <div>
                  <h1 class="text-2xl font-bold text-white">PDF Master Pro</h1>
                  <p class="text-xs text-blue-100">Complete PDF Solution • 30+ Tools</p>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center space-x-4">
              <!-- Statistics -->
              <div class="hidden md:block text-white text-sm">
                <div class="flex items-center space-x-4">
                  <span *ngIf="(state$ | async)?.files?.length" class="bg-white bg-opacity-20 px-3 py-1 rounded-full">
                    📁 {{(state$ | async)!.files.length}} Files
                  </span>
                  <span *ngIf="(state$ | async)?.selectedIndex !== null" class="bg-white bg-opacity-20 px-3 py-1 rounded-full">
                    ⚡ Ready to Process
                  </span>
                </div>
              </div>

              <!-- Undo/Redo Controls -->
              <div class="flex items-center space-x-2" *ngIf="state$ | async as state">
                <button
                  (click)="undo()"
                  [disabled]="!canUndo"
                  class="px-4 py-2 text-sm bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 backdrop-blur-sm"
                  title="Undo (Ctrl+Z)"
                >
                  <span class="flex items-center">
                    <span class="mr-2">↶</span> Undo
                    <span *ngIf="undoCount > 0" class="ml-1 text-xs bg-white bg-opacity-30 rounded-full px-2">{{undoCount}}</span>
                  </span>
                </button>
                <button
                  (click)="redo()"
                  [disabled]="!canRedo"
                  class="px-4 py-2 text-sm bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 backdrop-blur-sm"
                  title="Redo (Ctrl+Y)"
                >
                  <span class="flex items-center">
                    <span class="mr-2">↷</span> Redo
                  </span>
                </button>
              </div>

              <!-- Dark Mode Toggle -->
              <button
                (click)="toggleDarkMode()"
                class="p-3 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 focus:outline-none transition-all duration-200 backdrop-blur-sm"
                title="Toggle Dark Mode"
              >
                <span *ngIf="!darkMode">🌙</span>
                <span *ngIf="darkMode">☀️</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <!-- Main Content -->
      <main class="flex-1 overflow-hidden">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <!-- Hero Section with File Upload -->
          <div class="mb-12">
            <!-- Hero Text -->
            <div class="text-center mb-8">
              <h1 class="text-4xl font-bold text-gray-900 mb-4">
                All-in-One PDF Solution
              </h1>
              <p class="text-xl text-gray-600 mb-6 max-w-3xl mx-auto">
                Convert, compress, merge, split, and edit your PDF files with our comprehensive suite of 30+ professional tools.
                Fast, secure, and completely free.
              </p>
              <div class="flex justify-center space-x-6 text-sm text-gray-500">
                <span class="flex items-center"><span class="w-2 h-2 bg-green-500 rounded-full mr-2"></span>100% Secure</span>
                <span class="flex items-center"><span class="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>No Registration</span>
                <span class="flex items-center"><span class="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>All Devices</span>
              </div>
            </div>

            <!-- File Upload Area -->
            <div class="relative">
              <div
                class="border-2 border-dashed border-blue-300 rounded-2xl p-12 text-center hover:border-blue-400 transition-all duration-300 bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100"
                [class.border-blue-500]="isDragOver"
                [class.bg-blue-100]="isDragOver"
                (dragover)="onDragOver($event)"
                (dragleave)="onDragLeave($event)"
                (drop)="onDrop($event)"
              >
                <div class="space-y-6">
                  <div class="text-6xl animate-bounce">📄</div>
                  <div>
                    <p class="text-2xl font-semibold text-gray-900 mb-2">Upload Your PDF Files</p>
                    <p class="text-lg text-gray-600 mb-4">Drag and drop files here or click to browse</p>
                    <p class="text-sm text-gray-500">Supports multiple PDF files • Max 50MB per file</p>
                  </div>
                  <div class="flex flex-col sm:flex-row items-center justify-center space-y-3 sm:space-y-0 sm:space-x-4">
                    <input
                      type="file"
                      accept=".pdf"
                      multiple
                      (change)="onFileSelect($event)"
                      class="hidden"
                      #fileInput
                    >
                    <button
                      (click)="fileInput.click()"
                      class="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-4 focus:ring-blue-300 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      <span class="flex items-center">
                        <span class="mr-2">📁</span> Select PDF Files
                      </span>
                    </button>
                    <span class="text-gray-400">or</span>
                    <button
                      (click)="showSampleFiles()"
                      class="px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 font-medium rounded-xl hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all duration-200"
                    >
                      <span class="flex items-center">
                        <span class="mr-2">🎯</span> Try Sample PDF
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Files List -->
          <div *ngIf="state$ | async as state" class="space-y-4">
            <div *ngIf="state.files.length > 0">
              <h2 class="text-lg font-medium text-gray-900 mb-4">Uploaded Files</h2>
              <div class="grid gap-4">
                <div
                  *ngFor="let file of state.files; let i = index"
                  class="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
                  [class.ring-2]="state.selectedIndex === i"
                  [class.ring-blue-500]="state.selectedIndex === i"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                      <div class="text-2xl">📄</div>
                      <div>
                        <h3 class="font-medium text-gray-900">{{file.name}}</h3>
                        <p class="text-sm text-gray-500">{{formatFileSize(file.size)}}</p>
                      </div>
                    </div>
                    <div class="flex items-center space-x-2">
                      <button
                        (click)="selectFile(i)"
                        class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        {{state.selectedIndex === i ? 'Selected' : 'Select'}}
                      </button>
                      <button
                        (click)="previewFile(file)"
                        class="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                        title="Preview PDF"
                      >
                        👁️ Preview
                      </button>
                      <button
                        (click)="downloadFile(file)"
                        class="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                        title="Download PDF"
                      >
                        ⬇️ Download
                      </button>
                      <button
                        (click)="removeFile(i)"
                        class="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- No Files Message -->
            <div *ngIf="state.files.length === 0" class="text-center py-12">
              <div class="text-4xl mb-4">📁</div>
              <p class="text-lg text-gray-500">No files uploaded yet</p>
              <p class="text-sm text-gray-400">Upload PDF files to get started</p>
            </div>
          </div>

          <!-- All PDF Tools - Always Visible -->
          <div class="mt-8">
            <!-- Quick Actions for Selected File -->
            <div *ngIf="(state$ | async)?.selectedIndex !== null" class="mb-8">
              <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
                <h2 class="text-lg font-semibold text-blue-900 mb-4 flex items-center">
                  <span class="mr-2">⚡</span>Quick Actions for Selected File
                </h2>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    (click)="compressSelected()"
                    [disabled]="loading['compressing']"
                    class="p-3 bg-white border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors"
                  >
                    <div class="text-xl mb-1">🗜️</div>
                    <div class="text-xs font-medium">Compress</div>
                  </button>

                  <button
                    (click)="addWatermarkToSelected()"
                    [disabled]="loading['watermarking']"
                    class="p-3 bg-white border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors"
                  >
                    <div class="text-xl mb-1">💧</div>
                    <div class="text-xs font-medium">Watermark</div>
                  </button>

                  <button
                    (click)="rotatePdfPages()"
                    [disabled]="loading['rotating']"
                    class="p-3 bg-white border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors"
                  >
                    <div class="text-xl mb-1">🔄</div>
                    <div class="text-xs font-medium">Rotate</div>
                  </button>

                  <button
                    (click)="protectWithPassword()"
                    [disabled]="loading['protecting']"
                    class="p-3 bg-white border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors"
                  >
                    <div class="text-xl mb-1">🔒</div>
                    <div class="text-xs font-medium">Protect</div>
                  </button>
                </div>
              </div>
            </div>

            <!-- All PDF Tools Categories -->
            <div class="space-y-6">
              <!-- Convert from PDF -->
              <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <span class="mr-3 text-2xl">📄</span>Convert from PDF
                </h3>
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <button
                    (click)="convertPdfToWord()"
                    [disabled]="loading['converting']"
                    class="group p-4 bg-gradient-to-b from-blue-50 to-blue-100 border border-blue-200 rounded-xl hover:from-blue-100 hover:to-blue-200 transition-all duration-200 disabled:opacity-50"
                  >
                    <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">📝</div>
                    <div class="text-sm font-medium text-blue-800">PDF to Word</div>
                  </button>

                  <button
                    (click)="convertPdfToExcel()"
                    [disabled]="loading['converting']"
                    class="group p-4 bg-gradient-to-b from-green-50 to-green-100 border border-green-200 rounded-xl hover:from-green-100 hover:to-green-200 transition-all duration-200 disabled:opacity-50"
                  >
                    <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">📊</div>
                    <div class="text-sm font-medium text-green-800">PDF to Excel</div>
                  </button>

                  <button
                    (click)="convertPdfToPowerPoint()"
                    [disabled]="loading['converting']"
                    class="group p-4 bg-gradient-to-b from-orange-50 to-orange-100 border border-orange-200 rounded-xl hover:from-orange-100 hover:to-orange-200 transition-all duration-200 disabled:opacity-50"
                  >
                    <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">📈</div>
                    <div class="text-sm font-medium text-orange-800">PDF to PPT</div>
                  </button>

                  <button
                    (click)="convertPdfToImages()"
                    [disabled]="loading['converting']"
                    class="group p-4 bg-gradient-to-b from-purple-50 to-purple-100 border border-purple-200 rounded-xl hover:from-purple-100 hover:to-purple-200 transition-all duration-200 disabled:opacity-50"
                  >
                    <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">🖼️</div>
                    <div class="text-sm font-medium text-purple-800">PDF to Images</div>
                  </button>

                  <button
                    (click)="extractTextFromPdf()"
                    [disabled]="loading['extracting']"
                    class="group p-4 bg-gradient-to-b from-gray-50 to-gray-100 border border-gray-200 rounded-xl hover:from-gray-100 hover:to-gray-200 transition-all duration-200 disabled:opacity-50"
                  >
                    <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">📝</div>
                    <div class="text-sm font-medium text-gray-800">Extract Text</div>
                  </button>

                  <button
                    (click)="extractImagesFromPdf()"
                    [disabled]="loading['extracting']"
                    class="group p-4 bg-gradient-to-b from-pink-50 to-pink-100 border border-pink-200 rounded-xl hover:from-pink-100 hover:to-pink-200 transition-all duration-200 disabled:opacity-50"
                  >
                    <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">🖼️</div>
                    <div class="text-sm font-medium text-pink-800">Extract Images</div>
                  </button>
                </div>
              </div>

              <!-- Convert to PDF -->
              <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <span class="mr-3 text-2xl">📄</span>Convert to PDF
                </h3>
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <button
                    (click)="convertWordToPdf()"
                    class="group p-4 bg-gradient-to-b from-blue-50 to-blue-100 border border-blue-200 rounded-xl hover:from-blue-100 hover:to-blue-200 transition-all duration-200"
                  >
                    <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">📝</div>
                    <div class="text-sm font-medium text-blue-800">Word to PDF</div>
                  </button>

                  <button
                    (click)="convertExcelToPdf()"
                    class="group p-4 bg-gradient-to-b from-green-50 to-green-100 border border-green-200 rounded-xl hover:from-green-100 hover:to-green-200 transition-all duration-200"
                  >
                    <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">📊</div>
                    <div class="text-sm font-medium text-green-800">Excel to PDF</div>
                  </button>

                  <button
                    (click)="convertPowerPointToPdf()"
                    class="group p-4 bg-gradient-to-b from-orange-50 to-orange-100 border border-orange-200 rounded-xl hover:from-orange-100 hover:to-orange-200 transition-all duration-200"
                  >
                    <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">📈</div>
                    <div class="text-sm font-medium text-orange-800">PPT to PDF</div>
                  </button>

                  <button
                    (click)="convertImagesToPdf()"
                    class="group p-4 bg-gradient-to-b from-purple-50 to-purple-100 border border-purple-200 rounded-xl hover:from-purple-100 hover:to-purple-200 transition-all duration-200"
                  >
                    <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">🖼️</div>
                    <div class="text-sm font-medium text-purple-800">Images to PDF</div>
                  </button>

                  <button
                    (click)="scanDocumentToPdf()"
                    class="group p-4 bg-gradient-to-b from-indigo-50 to-indigo-100 border border-indigo-200 rounded-xl hover:from-indigo-100 hover:to-indigo-200 transition-all duration-200"
                  >
                    <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">📷</div>
                    <div class="text-sm font-medium text-indigo-800">Scan to PDF</div>
                  </button>

                  <button
                    (click)="htmlToPdf()"
                    class="group p-4 bg-gradient-to-b from-teal-50 to-teal-100 border border-teal-200 rounded-xl hover:from-teal-100 hover:to-teal-200 transition-all duration-200"
                  >
                    <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">🌐</div>
                    <div class="text-sm font-medium text-teal-800">HTML to PDF</div>
                  </button>
                </div>
              </div>

              <!-- Organize PDF -->
              <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <span class="mr-3 text-2xl">🗂️</span>Organize PDF
                </h3>
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <button
                    (click)="mergeAllFiles()"
                    [disabled]="loading['merging'] || (state$ | async)!.files.length < 2"
                    class="group p-4 bg-gradient-to-b from-blue-50 to-blue-100 border border-blue-200 rounded-xl hover:from-blue-100 hover:to-blue-200 transition-all duration-200 disabled:opacity-50"
                  >
                    <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">📎</div>
                    <div class="text-sm font-medium text-blue-800">Merge PDF</div>
                  </button>

                  <button
                    (click)="splitPdfPages()"
                    [disabled]="loading['splitting']"
                    class="group p-4 bg-gradient-to-b from-green-50 to-green-100 border border-green-200 rounded-xl hover:from-green-100 hover:to-green-200 transition-all duration-200 disabled:opacity-50"
                  >
                    <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">✂️</div>
                    <div class="text-sm font-medium text-green-800">Split PDF</div>
                  </button>

                  <button
                    (click)="deletePdfPages()"
                    [disabled]="loading['deleting']"
                    class="group p-4 bg-gradient-to-b from-red-50 to-red-100 border border-red-200 rounded-xl hover:from-red-100 hover:to-red-200 transition-all duration-200 disabled:opacity-50"
                  >
                    <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">🗑️</div>
                    <div class="text-sm font-medium text-red-800">Delete Pages</div>
                  </button>

                  <button
                    (click)="extractPdfPages()"
                    [disabled]="loading['extracting']"
                    class="group p-4 bg-gradient-to-b from-purple-50 to-purple-100 border border-purple-200 rounded-xl hover:from-purple-100 hover:to-purple-200 transition-all duration-200 disabled:opacity-50"
                  >
                    <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">📄</div>
                    <div class="text-sm font-medium text-purple-800">Extract Pages</div>
                  </button>

                  <button
                    (click)="rotatePdfPages()"
                    [disabled]="loading['rotating']"
                    class="group p-4 bg-gradient-to-b from-orange-50 to-orange-100 border border-orange-200 rounded-xl hover:from-orange-100 hover:to-orange-200 transition-all duration-200 disabled:opacity-50"
                  >
                    <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">🔄</div>
                    <div class="text-sm font-medium text-orange-800">Rotate PDF</div>
                  </button>

                  <button
                    (click)="reorderPdfPages()"
                    [disabled]="loading['reordering']"
                    class="group p-4 bg-gradient-to-b from-indigo-50 to-indigo-100 border border-indigo-200 rounded-xl hover:from-indigo-100 hover:to-indigo-200 transition-all duration-200 disabled:opacity-50"
                  >
                    <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">🔀</div>
                    <div class="text-sm font-medium text-indigo-800">Reorder Pages</div>
                  </button>
                </div>
              </div>

              <!-- PDF Security -->
              <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <span class="mr-3 text-2xl">🔐</span>PDF Security
                </h3>
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <button
                    (click)="protectWithPassword()"
                    [disabled]="loading['protecting']"
                    class="group p-4 bg-gradient-to-b from-red-50 to-red-100 border border-red-200 rounded-xl hover:from-red-100 hover:to-red-200 transition-all duration-200 disabled:opacity-50"
                  >
                    <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">🔒</div>
                    <div class="text-sm font-medium text-red-800">Protect PDF</div>
                  </button>

                  <button
                    (click)="unlockPdf()"
                    [disabled]="loading['unlocking']"
                    class="group p-4 bg-gradient-to-b from-green-50 to-green-100 border border-green-200 rounded-xl hover:from-green-100 hover:to-green-200 transition-all duration-200 disabled:opacity-50"
                  >
                    <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">🔓</div>
                    <div class="text-sm font-medium text-green-800">Unlock PDF</div>
                  </button>

                  <button
                    (click)="addDigitalSignature()"
                    [disabled]="loading['signing']"
                    class="group p-4 bg-gradient-to-b from-blue-50 to-blue-100 border border-blue-200 rounded-xl hover:from-blue-100 hover:to-blue-200 transition-all duration-200 disabled:opacity-50"
                  >
                    <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">✍️</div>
                    <div class="text-sm font-medium text-blue-800">Sign PDF</div>
                  </button>

                  <button
                    (click)="validateSignatures()"
                    [disabled]="loading['validating']"
                    class="group p-4 bg-gradient-to-b from-purple-50 to-purple-100 border border-purple-200 rounded-xl hover:from-purple-100 hover:to-purple-200 transition-all duration-200 disabled:opacity-50"
                  >
                    <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">✅</div>
                    <div class="text-sm font-medium text-purple-800">Validate Signs</div>
                  </button>

                  <button
                    (click)="addWatermarkToSelected()"
                    [disabled]="loading['watermarking']"
                    class="group p-4 bg-gradient-to-b from-cyan-50 to-cyan-100 border border-cyan-200 rounded-xl hover:from-cyan-100 hover:to-cyan-200 transition-all duration-200 disabled:opacity-50"
                  >
                    <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">💧</div>
                    <div class="text-sm font-medium text-cyan-800">Watermark</div>
                  </button>

                  <button
                    (click)="removeWatermark()"
                    [disabled]="loading['removing']"
                    class="group p-4 bg-gradient-to-b from-gray-50 to-gray-100 border border-gray-200 rounded-xl hover:from-gray-100 hover:to-gray-200 transition-all duration-200 disabled:opacity-50"
                  >
                    <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">🧹</div>
                    <div class="text-sm font-medium text-gray-800">Remove Mark</div>
                  </button>
                </div>
              </div>

              <!-- PDF Tools -->
              <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <span class="mr-3 text-2xl">🛠️</span>PDF Tools
                </h3>
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <button
                    (click)="compressSelected()"
                    [disabled]="loading['compressing']"
                    class="group p-4 bg-gradient-to-b from-green-50 to-green-100 border border-green-200 rounded-xl hover:from-green-100 hover:to-green-200 transition-all duration-200 disabled:opacity-50"
                  >
                    <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">🗜️</div>
                    <div class="text-sm font-medium text-green-800">Compress</div>
                  </button>

                  <button
                    (click)="optimizePdf()"
                    [disabled]="loading['optimizing']"
                    class="group p-4 bg-gradient-to-b from-blue-50 to-blue-100 border border-blue-200 rounded-xl hover:from-blue-100 hover:to-blue-200 transition-all duration-200 disabled:opacity-50"
                  >
                    <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">⚡</div>
                    <div class="text-sm font-medium text-blue-800">Optimize</div>
                  </button>

                  <button
                    (click)="repairPdf()"
                    [disabled]="loading['repairing']"
                    class="group p-4 bg-gradient-to-b from-yellow-50 to-yellow-100 border border-yellow-200 rounded-xl hover:from-yellow-100 hover:to-yellow-200 transition-all duration-200 disabled:opacity-50"
                  >
                    <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">🔧</div>
                    <div class="text-sm font-medium text-yellow-800">Repair PDF</div>
                  </button>

                  <button
                    (click)="cropPdf()"
                    [disabled]="loading['cropping']"
                    class="group p-4 bg-gradient-to-b from-purple-50 to-purple-100 border border-purple-200 rounded-xl hover:from-purple-100 hover:to-purple-200 transition-all duration-200 disabled:opacity-50"
                  >
                    <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">✂️</div>
                    <div class="text-sm font-medium text-purple-800">Crop PDF</div>
                  </button>

                  <button
                    (click)="resizePdf()"
                    [disabled]="loading['resizing']"
                    class="group p-4 bg-gradient-to-b from-indigo-50 to-indigo-100 border border-indigo-200 rounded-xl hover:from-indigo-100 hover:to-indigo-200 transition-all duration-200 disabled:opacity-50"
                  >
                    <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">📏</div>
                    <div class="text-sm font-medium text-indigo-800">Resize PDF</div>
                  </button>

                  <button
                    (click)="clearAllFiles()"
                    class="group p-4 bg-gradient-to-b from-red-50 to-red-100 border border-red-200 rounded-xl hover:from-red-100 hover:to-red-200 transition-all duration-200"
                  >
                    <div class="text-2xl mb-2 group-hover:scale-110 transition-transform">🗑️</div>
                    <div class="text-sm font-medium text-red-800">Clear All</div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Status Messages -->
          <div *ngIf="(state$ | async)?.error" class="mt-4">
            <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {{(state$ | async)?.error}}
            </div>
          </div>
        </div>
      </main>

      <!-- PDF Preview Modal -->
      <div *ngIf="showPageView" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" (click)="closePreview()">
        <div class="bg-white rounded-lg p-6 max-w-5xl max-h-[95vh] overflow-hidden flex flex-col" (click)="$event.stopPropagation()">
          <!-- Header -->
          <div class="flex flex-col space-y-3 mb-4">
            <!-- Title Row -->
            <div class="flex justify-between items-center">
              <div>
                <h3 class="text-lg font-medium">PDF Preview</h3>
                <p class="text-sm text-gray-500" *ngIf="currentPreviewFile">{{currentPreviewFile.name}}</p>
              </div>
              <button
                (click)="closePreview()"
                class="text-gray-500 hover:text-gray-700 p-2"
                title="Close (Esc)"
              >
                ✕
              </button>
            </div>

            <!-- Controls Row -->
            <div class="flex flex-wrap items-center justify-between gap-4">
              <!-- Page Navigation -->
              <div class="flex items-center space-x-2" *ngIf="previewPages.length > 0">
                <button
                  (click)="previousPage()"
                  [disabled]="currentPreviewPageIndex === 0"
                  class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                  title="Previous Page (←)"
                >
                  ← Prev
                </button>

                <!-- Direct Page Input -->
                <div class="flex items-center space-x-1">
                  <span class="text-sm text-gray-600">Page</span>
                  <input
                    type="number"
                    [(ngModel)]="pageNumberInput"
                    (keyup.enter)="goToPageNumber()"
                    (blur)="goToPageNumber()"
                    [min]="1"
                    [max]="previewPages.length"
                    class="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-center"
                  >
                  <span class="text-sm text-gray-600">of {{previewPages.length}}</span>
                </div>

                <button
                  (click)="nextPage()"
                  [disabled]="currentPreviewPageIndex === previewPages.length - 1"
                  class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                  title="Next Page (→)"
                >
                  Next →
                </button>
              </div>

              <!-- Zoom Controls -->
              <div class="flex items-center space-x-2">
                <button
                  (click)="zoomOut()"
                  [disabled]="previewZoom <= 0.25"
                  class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                  title="Zoom Out"
                >
                  🔍-
                </button>
                <span class="text-sm font-medium w-12 text-center">{{(previewZoom * 100).toFixed(0)}}%</span>
                <button
                  (click)="zoomIn()"
                  [disabled]="previewZoom >= 3"
                  class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                  title="Zoom In"
                >
                  🔍+
                </button>
                <button
                  (click)="resetZoom()"
                  class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  title="Reset Zoom"
                >
                  100%
                </button>
              </div>

              <!-- Action Buttons -->
              <div class="flex items-center space-x-2">
                <button
                  (click)="sharePreview()"
                  class="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                  title="Share PDF"
                >
                  📤 Share
                </button>
                <button
                  (click)="downloadCurrentPreview()"
                  class="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                  title="Download PDF"
                >
                  ⬇️ Download
                </button>
                <button
                  (click)="printPreview()"
                  class="px-3 py-1 text-sm bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                  title="Print PDF"
                >
                  🖨️ Print
                </button>
              </div>
            </div>
          </div>

          <!-- Preview Content -->
          <div class="flex-1 overflow-auto relative bg-gray-100"
               [class.overflow-hidden]="previewZoom > 1 && isDragging">
            <div
              *ngIf="currentPagePreview"
              class="min-h-full flex items-center justify-center p-4"
              [class.cursor-grab]="previewZoom > 1 && !isDragging"
              [class.cursor-grabbing]="previewZoom > 1 && isDragging"
              (mousedown)="previewZoom > 1 ? startDrag($event) : null"
              (mousemove)="previewZoom > 1 ? onDrag($event) : null"
              (mouseup)="endDrag()"
              (mouseleave)="endDrag()">
              <img
                [src]="currentPagePreview"
                alt="PDF Preview - Page {{currentPreviewPageIndex + 1}}"
                class="border border-gray-300 rounded shadow-lg select-none"
                [style.transform]="previewZoom > 1 ? 'scale(' + previewZoom + ') translate(' + (panX/previewZoom) + 'px, ' + (panY/previewZoom) + 'px)' : 'scale(1)'"
                [style.max-width]="previewZoom === 1 ? '100%' : 'none'"
                [style.max-height]="previewZoom === 1 ? '100%' : 'none'"
                [style.width]="previewZoom === 1 ? 'auto' : 'auto'"
                [style.height]="previewZoom === 1 ? 'auto' : 'auto'"
                [style.object-fit]="'contain'"
                [style.transition]="isDragging ? 'none' : 'transform 0.2s ease'"
                (dragstart)="$event.preventDefault()"
              >
            </div>
            <div *ngIf="!currentPagePreview && previewPages.length === 0" class="flex items-center justify-center h-full">
              <div class="text-center">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p class="text-gray-500">Loading preview...</p>
              </div>
            </div>

            <!-- Zoom indicator -->
            <div *ngIf="previewZoom > 1" class="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
              {{(previewZoom * 100).toFixed(0)}}% - Drag to pan
            </div>
          </div>

          <!-- Page Thumbnails -->
          <div *ngIf="previewPages.length > 1" class="mt-4 border-t pt-4">
            <div class="flex space-x-2 overflow-x-auto pb-2">
              <div
                *ngFor="let page of previewPages; let i = index"
                class="flex-shrink-0 cursor-pointer border-2 rounded"
                [class.border-blue-500]="i === currentPreviewPageIndex"
                [class.border-gray-300]="i !== currentPreviewPageIndex"
                (click)="goToPage(i)"
              >
                <img
                  [src]="page"
                  alt="Page {{i + 1}}"
                  class="w-16 h-20 object-cover rounded"
                >
                <div class="text-xs text-center py-1">{{i + 1}}</div>
              </div>
            </div>
          </div>

          <!-- Keyboard shortcuts info -->
          <div class="mt-2 text-xs text-gray-500 text-center">
            ← → Navigate pages • +/- Zoom • Esc Close • Enter Go to page
          </div>
        </div>
      </div>

      <!-- Footer -->
      <footer class="bg-white border-t border-gray-200">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div class="text-center text-sm text-gray-500">
            PDF Master Angular - Converted from React
          </div>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    .dark {
      background-color: #111827;
      color: #f9fafb;
    }
    .dark header {
      background-color: #1f2937;
      border-color: #374151;
    }
    .dark footer {
      background-color: #1f2937;
      border-color: #374151;
    }
  `]
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'pdf-master-angular';
  darkMode = false;

  state$: Observable<PdfState>;
  canUndo = false;
  canRedo = false;
  undoCount = 0;
  loading: { [key: string]: boolean } = {};

  // Page view properties
  currentPagePreview: string | null = null;
  showPageView = false;
  previewPages: string[] = [];
  currentPreviewPageIndex = 0;
  currentPreviewFile: File | null = null;
  previewZoom = 1;
  pageNumberInput = 1;

  // Drag and pan properties
  isDragging = false;
  dragStartX = 0;
  dragStartY = 0;
  panX = 0;
  panY = 0;

  // File upload drag state
  isDragOver = false;

  private destroy$ = new Subject<void>();

  constructor(
    private pdfStateService: PdfStateService,
    private snapshotService: SnapshotService
  ) {
    this.state$ = this.pdfStateService.state$;
  }

  ngOnInit(): void {
    // Subscribe to snapshot changes
    this.snapshotService.canUndo$
      .pipe(takeUntil(this.destroy$))
      .subscribe(canUndo => this.canUndo = canUndo);

    this.snapshotService.canRedo$
      .pipe(takeUntil(this.destroy$))
      .subscribe(canRedo => this.canRedo = canRedo);

    this.snapshotService.history$
      .pipe(takeUntil(this.destroy$))
      .subscribe(history => this.undoCount = history.length);

    // Subscribe to loading states
    this.pdfStateService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => this.loading = loading);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleDarkMode(): void {
    this.darkMode = !this.darkMode;
  }

  onFileSelect(event: any): void {
    const files = Array.from(event.target.files) as File[];
    if (files.length > 0) {
      this.pdfStateService.addFiles(files);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    const files = Array.from(event.dataTransfer?.files || []) as File[];
    const pdfFiles = files.filter(file => file.type === 'application/pdf');

    if (pdfFiles.length > 0) {
      this.pdfStateService.addFiles(pdfFiles);
    }
  }

  showSampleFiles(): void {
    this.showFeatureNotification('Sample PDF files - Feature coming soon! You can upload your own PDF files to get started.');
  }

  selectFile(index: number): void {
    this.pdfStateService.setSelectedIndex(index);
  }

  removeFile(index: number): void {
    this.pdfStateService.removeFile(index);
  }

  clearAllFiles(): void {
    if (confirm('Are you sure you want to clear all files?')) {
      this.pdfStateService.clearFiles();
    }
  }

  undo(): void {
    this.pdfStateService.undo();
  }

  redo(): void {
    this.pdfStateService.redo();
  }

  async compressSelected(): Promise<void> {
    const state = this.pdfStateService.currentState;
    if (state.selectedIndex !== null) {
      const file = state.files[state.selectedIndex];
      try {
        await this.pdfStateService.compressPdf(file, { jpegQuality: 0.7 });
        console.log('PDF compressed successfully');
      } catch (error) {
        this.pdfStateService.setError('Failed to compress PDF');
      }
    }
  }

  async addWatermarkToSelected(): Promise<void> {
    const watermarkText = prompt('Enter watermark text:');
    if (!watermarkText) return;

    const state = this.pdfStateService.currentState;
    if (state.selectedIndex !== null) {
      const file = state.files[state.selectedIndex];
      try {
        await this.pdfStateService.addWatermark(file, watermarkText, {
          fontSize: 50,
          opacity: 0.3,
          color: { r: 0.5, g: 0.5, b: 0.5 }
        });
        console.log('Watermark added successfully');
      } catch (error) {
        this.pdfStateService.setError('Failed to add watermark');
      }
    }
  }

  async mergeAllFiles(): Promise<void> {
    const state = this.pdfStateService.currentState;
    if (state.files.length >= 2) {
      try {
        const mergedBlob = await this.pdfStateService.mergePdfs(state.files);
        this.downloadBlob(mergedBlob, 'merged.pdf');
        console.log('PDFs merged successfully');
      } catch (error) {
        this.pdfStateService.setError('Failed to merge PDFs');
      }
    }
  }

  formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  downloadFile(file: File): void {
    this.downloadBlob(file, file.name);
  }

  async previewFile(file: File): Promise<void> {
    try {
      this.showPageView = true;
      this.currentPagePreview = null;
      this.previewPages = [];
      this.currentPreviewPageIndex = 0;
      this.currentPreviewFile = file;
      this.previewZoom = 1;
      this.pageNumberInput = 1;
      this.resetPan();

      // Generate preview using PDF.js
      const images = await this.pdfStateService.pdfUtils.pdfToImages(file);
      if (images.length > 0) {
        this.previewPages = images;
        this.currentPagePreview = images[0]; // Show first page
      }
    } catch (error) {
      console.error('Error generating preview:', error);
      this.pdfStateService.setError('Failed to generate PDF preview');
      this.closePreview();
    }
  }

  closePreview(): void {
    this.showPageView = false;
    this.currentPagePreview = null;
    this.previewPages = [];
    this.currentPreviewPageIndex = 0;
    this.currentPreviewFile = null;
    this.previewZoom = 1;
    this.pageNumberInput = 1;
    this.resetPan();
  }

  nextPage(): void {
    if (this.currentPreviewPageIndex < this.previewPages.length - 1) {
      this.currentPreviewPageIndex++;
      this.currentPagePreview = this.previewPages[this.currentPreviewPageIndex];
      this.pageNumberInput = this.currentPreviewPageIndex + 1;
      this.resetPan(); // Reset pan when changing pages
    }
  }

  previousPage(): void {
    if (this.currentPreviewPageIndex > 0) {
      this.currentPreviewPageIndex--;
      this.currentPagePreview = this.previewPages[this.currentPreviewPageIndex];
      this.pageNumberInput = this.currentPreviewPageIndex + 1;
      this.resetPan(); // Reset pan when changing pages
    }
  }

  goToPage(pageIndex: number): void {
    if (pageIndex >= 0 && pageIndex < this.previewPages.length) {
      this.currentPreviewPageIndex = pageIndex;
      this.currentPagePreview = this.previewPages[this.currentPreviewPageIndex];
      this.pageNumberInput = this.currentPreviewPageIndex + 1;
      this.resetPan(); // Reset pan when changing pages
    }
  }

  goToPageNumber(): void {
    const pageNumber = this.pageNumberInput;
    if (pageNumber >= 1 && pageNumber <= this.previewPages.length) {
      this.goToPage(pageNumber - 1);
    } else {
      // Reset to current page if invalid input
      this.pageNumberInput = this.currentPreviewPageIndex + 1;
    }
  }

  downloadCurrentPreview(): void {
    if (this.currentPreviewFile) {
      this.downloadFile(this.currentPreviewFile);
    }
  }

  // Zoom controls
  zoomIn(): void {
    if (this.previewZoom < 3) {
      this.previewZoom = Math.round((this.previewZoom + 0.25) * 100) / 100;
      if (this.previewZoom <= 1) {
        this.resetPan();
      }
    }
  }

  zoomOut(): void {
    if (this.previewZoom > 0.25) {
      this.previewZoom = Math.round((this.previewZoom - 0.25) * 100) / 100;
      // Reset pan if zoomed out to 1x or less
      if (this.previewZoom <= 1) {
        this.resetPan();
      }
    }
  }

  resetZoom(): void {
    this.previewZoom = 1;
    this.resetPan();
  }

  // Drag and pan functionality
  startDrag(event: MouseEvent): void {
    if (this.previewZoom > 1) {
      event.preventDefault();
      this.isDragging = true;
      this.dragStartX = event.clientX - this.panX;
      this.dragStartY = event.clientY - this.panY;
    }
  }

  onDrag(event: MouseEvent): void {
    if (this.isDragging && this.previewZoom > 1) {
      event.preventDefault();
      this.panX = event.clientX - this.dragStartX;
      this.panY = event.clientY - this.dragStartY;
    }
  }

  endDrag(): void {
    this.isDragging = false;
  }

  resetPan(): void {
    this.panX = 0;
    this.panY = 0;
    this.isDragging = false;
  }

  // Share functionality
  async sharePreview(): Promise<void> {
    if (!this.currentPreviewFile) return;

    try {
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [this.currentPreviewFile] })) {
        // Use native Web Share API if available
        await navigator.share({
          title: 'PDF Document',
          text: `Sharing ${this.currentPreviewFile.name}`,
          files: [this.currentPreviewFile]
        });
      } else {
        // Fallback: Copy file URL to clipboard or show share options
        await this.copyLinkToClipboard();
      }
    } catch (error) {
      console.error('Error sharing:', error);
      // Fallback to copying link
      await this.copyLinkToClipboard();
    }
  }

  private async copyLinkToClipboard(): Promise<void> {
    try {
      const url = URL.createObjectURL(this.currentPreviewFile!);
      await navigator.clipboard.writeText(url);

      // Show temporary notification
      this.pdfStateService.setError('Link copied to clipboard!');
      setTimeout(() => {
        this.pdfStateService.setError(null);
      }, 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      this.pdfStateService.setError('Sharing not supported on this device');
      setTimeout(() => {
        this.pdfStateService.setError(null);
      }, 3000);
    }
  }

  // Print functionality
  printPreview(): void {
    if (!this.currentPreviewFile) return;

    const url = URL.createObjectURL(this.currentPreviewFile);
    const printWindow = window.open(url, '_blank');

    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
        printWindow.onafterprint = () => {
          printWindow.close();
          URL.revokeObjectURL(url);
        };
      };
    } else {
      // Fallback: open in new tab if popup blocked
      window.open(url, '_blank');
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardShortcuts(event: KeyboardEvent): void {
    // Preview modal navigation
    if (this.showPageView) {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closePreview();
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        this.previousPage();
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        this.nextPage();
        return;
      }
      // Zoom controls
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        this.zoomIn();
        return;
      }
      if (event.key === '-') {
        event.preventDefault();
        this.zoomOut();
        return;
      }
      if (event.key === '0') {
        event.preventDefault();
        this.resetZoom();
        return;
      }
    }

    // Global shortcuts (only when preview is not open)
    if (!this.showPageView) {
      // Ctrl+Z for undo
      if (event.ctrlKey && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        if (this.canUndo) {
          this.undo();
        }
      }
      // Ctrl+Y or Ctrl+Shift+Z for redo
      if ((event.ctrlKey && event.key === 'y') || (event.ctrlKey && event.shiftKey && event.key === 'Z')) {
        event.preventDefault();
        if (this.canRedo) {
          this.redo();
        }
      }
    }
  }

  // ============= NEW ADVANCED PDF FEATURES =============

  // === CONVERSION FROM PDF ===
  async convertPdfToWord(): Promise<void> {
    if (!this.currentSelectedFile) {
      this.showFeatureNotification('Select a PDF file first to convert to Word');
      return;
    }
    this.showFeatureNotification('PDF to Word conversion - Feature coming soon!');
  }

  async convertPdfToExcel(): Promise<void> {
    if (!this.currentSelectedFile) {
      this.showFeatureNotification('Select a PDF file first to convert to Excel');
      return;
    }
    this.showFeatureNotification('PDF to Excel conversion - Feature coming soon!');
  }

  async convertPdfToPowerPoint(): Promise<void> {
    if (!this.currentSelectedFile) {
      this.showFeatureNotification('Select a PDF file first to convert to PowerPoint');
      return;
    }
    this.showFeatureNotification('PDF to PowerPoint conversion - Feature coming soon!');
  }

  async convertPdfToImages(): Promise<void> {
    if (!this.currentSelectedFile) {
      this.showFeatureNotification('Select a PDF file first to convert to images');
      return;
    }

    try {
      this.pdfStateService.setLoading('converting', true);

      // Use existing PDF to images functionality
      const images = await this.pdfStateService.pdfUtils.pdfToImages(this.currentSelectedFile);

      // Create a zip file with all images
      this.downloadImagesAsZip(images, this.currentSelectedFile.name);

      this.showFeatureNotification('PDF converted to images successfully!');
    } catch (error) {
      console.error('Error converting PDF to images:', error);
      this.pdfStateService.setError('Failed to convert PDF to images');
    } finally {
      this.pdfStateService.setLoading('converting', false);
    }
  }

  async extractTextFromPdf(): Promise<void> {
    if (!this.currentSelectedFile) {
      this.showFeatureNotification('Select a PDF file first to extract text');
      return;
    }
    this.showFeatureNotification('PDF text extraction - Feature coming soon!');
  }

  async extractImagesFromPdf(): Promise<void> {
    if (!this.currentSelectedFile) {
      this.showFeatureNotification('Select a PDF file first to extract images');
      return;
    }
    this.showFeatureNotification('PDF image extraction - Feature coming soon!');
  }

  // === CONVERSION TO PDF ===
  async convertWordToPdf(): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.doc,.docx';
    input.onchange = (event: any) => {
      const file = event.target.files[0];
      if (file) {
        this.showFeatureNotification(`Word to PDF conversion for ${file.name} - Feature coming soon!`);
      }
    };
    input.click();
  }

  async convertExcelToPdf(): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xls,.xlsx';
    input.onchange = (event: any) => {
      const file = event.target.files[0];
      if (file) {
        this.showFeatureNotification(`Excel to PDF conversion for ${file.name} - Feature coming soon!`);
      }
    };
    input.click();
  }

  async convertPowerPointToPdf(): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ppt,.pptx';
    input.onchange = (event: any) => {
      const file = event.target.files[0];
      if (file) {
        this.showFeatureNotification(`PowerPoint to PDF conversion for ${file.name} - Feature coming soon!`);
      }
    };
    input.click();
  }

  async convertImagesToPdf(): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = (event: any) => {
      const files = Array.from(event.target.files);
      if (files.length > 0) {
        this.showFeatureNotification(`Images to PDF conversion for ${files.length} files - Feature coming soon!`);
      }
    };
    input.click();
  }

  async scanDocumentToPdf(): Promise<void> {
    // Check if device supports camera
    if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
      this.showFeatureNotification('Document scanning - Feature coming soon! Will use device camera to scan documents.');
    } else {
      this.showFeatureNotification('Camera not available on this device');
    }
  }

  async htmlToPdf(): Promise<void> {
    this.showFeatureNotification('HTML to PDF conversion - Feature coming soon!');
  }

  // === PDF ORGANIZATION ===
  async splitPdfPages(): Promise<void> {
    if (!this.currentSelectedFile) {
      this.showFeatureNotification('Select a PDF file first to split pages');
      return;
    }
    this.showFeatureNotification('PDF page splitting - Feature coming soon!');
  }

  async deletePdfPages(): Promise<void> {
    if (!this.currentSelectedFile) {
      this.showFeatureNotification('Select a PDF file first to delete pages');
      return;
    }
    this.showFeatureNotification('PDF page deletion - Feature coming soon!');
  }

  async extractPdfPages(): Promise<void> {
    if (!this.currentSelectedFile) {
      this.showFeatureNotification('Select a PDF file first to extract pages');
      return;
    }
    this.showFeatureNotification('PDF page extraction - Feature coming soon!');
  }

  async rotatePdfPages(): Promise<void> {
    if (!this.currentSelectedFile) {
      this.showFeatureNotification('Select a PDF file first to rotate pages');
      return;
    }
    this.showFeatureNotification('PDF page rotation - Feature coming soon!');
  }

  async reorderPdfPages(): Promise<void> {
    if (!this.currentSelectedFile) {
      this.showFeatureNotification('Select a PDF file first to reorder pages');
      return;
    }
    this.showFeatureNotification('PDF page reordering - Feature coming soon!');
  }

  // === PDF SECURITY ===
  async protectWithPassword(): Promise<void> {
    if (!this.currentSelectedFile) {
      this.showFeatureNotification('Select a PDF file first to add password protection');
      return;
    }
    this.showFeatureNotification('PDF password protection - Feature coming soon!');
  }

  async unlockPdf(): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = (event: any) => {
      const file = event.target.files[0];
      if (file) {
        this.showFeatureNotification(`PDF unlock for ${file.name} - Feature coming soon!`);
      }
    };
    input.click();
  }

  async addDigitalSignature(): Promise<void> {
    if (!this.currentSelectedFile) {
      this.showFeatureNotification('Select a PDF file first to add digital signature');
      return;
    }
    this.showFeatureNotification('Digital signature - Feature coming soon!');
  }

  async validateSignatures(): Promise<void> {
    if (!this.currentSelectedFile) {
      this.showFeatureNotification('Select a PDF file first to validate signatures');
      return;
    }
    this.showFeatureNotification('Signature validation - Feature coming soon!');
  }

  async removeWatermark(): Promise<void> {
    if (!this.currentSelectedFile) {
      this.showFeatureNotification('Select a PDF file first to remove watermarks');
      return;
    }
    this.showFeatureNotification('Watermark removal - Feature coming soon!');
  }

  // === PDF TOOLS ===
  async optimizePdf(): Promise<void> {
    if (!this.currentSelectedFile) {
      this.showFeatureNotification('Select a PDF file first to optimize');
      return;
    }
    this.showFeatureNotification('PDF optimization - Feature coming soon!');
  }

  async repairPdf(): Promise<void> {
    if (!this.currentSelectedFile) {
      this.showFeatureNotification('Select a PDF file first to repair');
      return;
    }
    this.showFeatureNotification('PDF repair - Feature coming soon!');
  }

  async cropPdf(): Promise<void> {
    if (!this.currentSelectedFile) {
      this.showFeatureNotification('Select a PDF file first to crop');
      return;
    }
    this.showFeatureNotification('PDF cropping - Feature coming soon!');
  }

  async resizePdf(): Promise<void> {
    if (!this.currentSelectedFile) {
      this.showFeatureNotification('Select a PDF file first to resize');
      return;
    }
    this.showFeatureNotification('PDF resizing - Feature coming soon!');
  }

  // === UTILITY METHODS ===
  get currentSelectedFile(): File | null {
    const selectedIndex = this.pdfStateService.currentState.selectedIndex;
    if (selectedIndex !== null && selectedIndex >= 0) {
      return this.pdfStateService.currentState.files[selectedIndex] || null;
    }
    return null;
  }

  private showFeatureNotification(message: string): void {
    this.pdfStateService.setError(message);
    setTimeout(() => {
      this.pdfStateService.setError(null);
    }, 3000);
  }

  private downloadImagesAsZip(images: string[], pdfName: string): void {
    // Simple implementation - in a real app, you'd use a zip library
    const zip = new Blob([], { type: 'application/zip' });
    const url = URL.createObjectURL(zip);

    // For now, download each image separately
    images.forEach((imageData, index) => {
      const link = document.createElement('a');
      link.href = imageData;
      link.download = `${pdfName.replace('.pdf', '')}_page_${index + 1}.png`;
      link.click();
    });

    this.showFeatureNotification(`Downloaded ${images.length} images from PDF`);
  }
}
