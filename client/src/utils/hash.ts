/**
 * Calculates SHA-256 checksum of a File or Blob using browser Web Crypto API.
 */
export const calculateFileHash = async (file: File | Blob): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};
