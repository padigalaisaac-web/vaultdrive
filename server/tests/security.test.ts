import { describe, it, expect } from 'vitest';
import { sanitizeFilename, resolveSafePath } from '../src/utils/pathSanitizer.js';

describe('Security & Path Traversal Tests', () => {
  it('should sanitize path traversal attempts in filenames', () => {
    expect(sanitizeFilename('../../../etc/passwd')).not.toContain('..');
    expect(sanitizeFilename('..\\..\\windows\\system32\\cmd.exe')).not.toContain('..');
    expect(sanitizeFilename('\0malicious.exe')).not.toContain('\0');
  });

  it('should throw an error when resolving paths outside root baseDir', () => {
    const baseDir = 'C:\\storage\\users\\123';
    expect(() => {
      resolveSafePath(baseDir, '..', '..', 'system32');
    }).toThrow();
  });
});
