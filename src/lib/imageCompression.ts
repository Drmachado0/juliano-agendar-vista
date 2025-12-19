/**
 * Utilitário para compressão de imagens antes do upload
 * Otimizado para envio via WhatsApp
 */

const MAX_WIDTH = 800;
const MAX_HEIGHT = 800;
const JPEG_QUALITY = 0.7;
const MAX_FILE_SIZE = 500 * 1024; // 500KB target

export interface CompressedImage {
  blob: Blob;
  base64: string;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
}

/**
 * Comprime uma imagem base64 para um tamanho otimizado para WhatsApp
 */
export async function compressImage(base64Input: string): Promise<CompressedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        // Calculate new dimensions maintaining aspect ratio
        let { width, height } = img;
        const originalSize = base64Input.length;
        
        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        
        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível criar contexto do canvas'));
          return;
        }
        
        // Enable image smoothing for better quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to JPEG with quality setting
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Falha ao comprimir imagem'));
              return;
            }
            
            // Convert blob to base64
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = reader.result as string;
              resolve({
                blob,
                base64,
                width,
                height,
                originalSize,
                compressedSize: blob.size,
              });
            };
            reader.onerror = () => reject(new Error('Erro ao converter imagem'));
            reader.readAsDataURL(blob);
          },
          'image/jpeg',
          JPEG_QUALITY
        );
      } catch (err) {
        reject(err);
      }
    };
    
    img.onerror = () => reject(new Error('Erro ao carregar imagem'));
    
    // Handle both raw base64 and data URL formats
    if (base64Input.startsWith('data:')) {
      img.src = base64Input;
    } else {
      img.src = `data:image/jpeg;base64,${base64Input}`;
    }
  });
}

/**
 * Extrai o base64 puro de uma string data URL
 */
export function extractPureBase64(dataUrl: string): string {
  if (dataUrl.includes(';base64,')) {
    return dataUrl.split(';base64,')[1];
  }
  return dataUrl;
}

/**
 * Converte um Blob em base64
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Erro ao converter blob'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Formata o tamanho do arquivo em uma string legível
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
