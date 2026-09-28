import path from 'path';

/**
 * Sanitizes and validates a relative or storage path to prevent Path Traversal attacks.
 * Disallows `..`, absolute traversal outside base directory, null bytes, and malicious control characters.
 */
export const sanitizeFilename = (filename: string): string => {
  if (!filename) return 'unnamed_file';
  
  // Remove null bytes
  let clean = filename.replace(/\0/g, '');
  
  // Repeatedly strip .. traversal patterns
  while (clean.includes('..')) {
    clean = clean.replace(/\.\./g, '');
  }
  
  // Replace slashes with underscores
  clean = clean.replace(/[\/\\]+/g, '_');
  
  // Trim leading/trailing dots, underscores, and spaces
  clean = clean.replace(/^[\._\s]+|[\._\s]+$/g, '');
  
  // If empty after sanitization, fallback
  if (!clean) {
    clean = `file_${Date.now()}`;
  }
  
  // Limit max filename length
  if (clean.length > 255) {
    const ext = path.extname(clean);
    clean = clean.substring(0, 255 - ext.length) + ext;
  }
  
  return clean;
};

/**
 * Ensures that a target path strictly resolves within the intended root base path.
 */
export const resolveSafePath = (baseDir: string, ...subPaths: string[]): string => {
  const resolvedBase = path.resolve(baseDir);
  const targetPath = path.resolve(resolvedBase, ...subPaths);
  
  // Strict traversal containment check
  if (!targetPath.startsWith(resolvedBase)) {
    throw new Error('Security Error: Path traversal attempt detected.');
  }
  
  return targetPath;
};
