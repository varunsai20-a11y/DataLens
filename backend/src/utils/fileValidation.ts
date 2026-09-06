import fs from 'fs';
import path from 'path';

export interface FileValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Sanitizes user-supplied original filename to prevent path traversal and control character injection.
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return 'unnamed_file';
  // Strip any directory paths (both POSIX and Windows separators)
  let clean = path.basename(filename);
  // Remove null bytes, line breaks, tabs, and invalid path chars
  clean = clean.replace(/[\0\r\n\t]/g, '');
  // Remove path traversal sequences
  clean = clean.replace(/\.\.+/g, '.');
  return clean || 'unnamed_file';
}

/**
 * Verifies that a target file path resolves strictly within the allowed parent directory.
 */
export function isPathInsideDir(targetPath: string, parentDir: string): boolean {
  const resolvedParent = path.resolve(parentDir);
  const resolvedTarget = path.resolve(targetPath);
  return resolvedTarget.startsWith(resolvedParent + path.sep) || resolvedTarget === resolvedParent;
}

/**
 * Inspects file content/magic bytes to verify format integrity.
 */
export function validateFileContent(filePath: string, ext: string, fileSize: number): FileValidationResult {
  const normalizedExt = ext.toLowerCase();

  if (fileSize === 0) {
    return { valid: false, reason: 'The uploaded file is empty (0 bytes).' };
  }

  const fd = fs.openSync(filePath, 'r');
  try {
    const headerBuf = Buffer.alloc(Math.min(512, fileSize));
    fs.readSync(fd, headerBuf, 0, headerBuf.length, 0);

    // Parquet signature check
    if (normalizedExt === '.parquet' || normalizedExt === '.pq') {
      if (fileSize < 8) {
        return { valid: false, reason: 'Parquet file is too small to contain valid headers.' };
      }
      const headerMagic = headerBuf.subarray(0, 4).toString('ascii');
      if (headerMagic !== 'PAR1') {
        return { valid: false, reason: 'Invalid Parquet magic bytes in header. File must start with PAR1.' };
      }

      const footerBuf = Buffer.alloc(4);
      fs.readSync(fd, footerBuf, 0, 4, fileSize - 4);
      const footerMagic = footerBuf.toString('ascii');
      if (footerMagic !== 'PAR1') {
        return { valid: false, reason: 'Invalid Parquet magic bytes in footer. File must end with PAR1.' };
      }

      return { valid: true };
    }

    // CSV content check
    if (normalizedExt === '.csv') {
      const isMZ = headerBuf.length >= 2 && headerBuf[0] === 0x4d && headerBuf[1] === 0x5a;
      const isELF = headerBuf.length >= 4 && headerBuf[0] === 0x7f && headerBuf[1] === 0x45 && headerBuf[2] === 0x4c && headerBuf[3] === 0x46;
      const isPK = headerBuf.length >= 4 && headerBuf[0] === 0x50 && headerBuf[1] === 0x4b && headerBuf[2] === 0x03 && headerBuf[3] === 0x04;
      const isPDF = headerBuf.length >= 4 && headerBuf.subarray(0, 4).toString('ascii') === '%PDF';
      const isGzip = headerBuf.length >= 2 && headerBuf[0] === 0x1f && headerBuf[1] === 0x8b;

      if (isMZ || isELF || isPK || isPDF || isGzip) {
        return { valid: false, reason: 'Invalid CSV content: Binary file signature detected.' };
      }

      let nullCount = 0;
      let nonPrintableCount = 0;
      for (let i = 0; i < headerBuf.length; i++) {
        const byte = headerBuf[i];
        if (byte === 0x00) nullCount++;
        else if (byte < 0x09 || (byte > 0x0d && byte < 0x20 && byte !== 0x1b)) {
          nonPrintableCount++;
        }
      }

      if (nullCount > 0 || nonPrintableCount > headerBuf.length * 0.1) {
        return { valid: false, reason: 'Invalid CSV content: File contains binary or unreadable control characters.' };
      }

      return { valid: true };
    }

    return { valid: false, reason: `Unsupported file extension '${ext}'.` };
  } finally {
    fs.closeSync(fd);
  }
}
