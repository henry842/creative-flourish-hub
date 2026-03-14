/**
 * Mask email for display: "he******@gmail.com"
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "***";
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 2)}${"*".repeat(Math.min(local.length - 2, 6))}@${domain}`;
}

/**
 * Validate file before upload
 */
const DANGEROUS_EXTENSIONS = [".exe", ".bat", ".cmd", ".com", ".msi", ".js", ".vbs", ".ps1", ".php", ".py", ".sh", ".jar", ".dll", ".scr"];

export function validateFileUpload(file: File): { valid: boolean; error?: string } {
  // Check size (10MB)
  if (file.size > 10 * 1024 * 1024) {
    return { valid: false, error: "Arquivo excede o limite de 10MB" };
  }

  // Check dangerous extensions
  const name = file.name.toLowerCase();
  for (const ext of DANGEROUS_EXTENSIONS) {
    if (name.endsWith(ext)) {
      return { valid: false, error: `Tipo de arquivo não permitido: ${ext}` };
    }
  }

  // Check if it claims to be PDF
  if (!name.endsWith(".pdf")) {
    return { valid: false, error: "Apenas arquivos PDF são aceitos" };
  }

  return { valid: true };
}

/**
 * Validate PDF magic bytes from ArrayBuffer
 */
export async function validatePdfBytes(file: File): Promise<{ valid: boolean; error?: string }> {
  const buffer = await file.slice(0, 5).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  // PDF magic bytes: %PDF
  if (bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) {
    return { valid: false, error: "O arquivo não é um PDF válido" };
  }
  return { valid: true };
}
