import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';

import { PdfPreviewDialogComponent, PdfPreviewDialogData } from '../components/pdf-preview-dialog.component';

export interface PdfPreviewOptions {
  file: File;
  title?: string;
  allowDownload?: boolean;
  allowPrint?: boolean;
  allowShare?: boolean;
}

export interface PdfPreviewResult {
  action: 'download' | 'print' | 'share' | 'close';
  file?: File;
}

@Injectable({
  providedIn: 'root'
})
export class PdfPreviewDialogService {

  constructor(private dialog: MatDialog) {}

  /**
   * Opens a PDF preview dialog
   * @param options Configuration options for the preview
   * @returns Observable that emits when dialog is closed with result
   */
  openPreview(options: PdfPreviewOptions): Observable<PdfPreviewResult | undefined> {
    const dialogData: PdfPreviewDialogData = {
      file: options.file,
      title: options.title || options.file.name,
      allowDownload: options.allowDownload ?? true,
      allowPrint: options.allowPrint ?? true,
      allowShare: options.allowShare ?? true
    };

    const dialogRef: MatDialogRef<PdfPreviewDialogComponent, PdfPreviewResult> =
      this.dialog.open(PdfPreviewDialogComponent, {
        width: '95vw',
        height: '95vh',
        maxWidth: '100vw',
        maxHeight: '100vh',
        panelClass: 'pdf-preview-dialog',
        data: dialogData,
        disableClose: false,
        autoFocus: false,
        restoreFocus: true
      });

    return dialogRef.afterClosed();
  }

  /**
   * Check if any preview dialog is currently open
   */
  isOpen(): boolean {
    return this.dialog.openDialogs.length > 0;
  }

  /**
   * Close all open preview dialogs
   */
  closeAll(): void {
    this.dialog.closeAll();
  }
}