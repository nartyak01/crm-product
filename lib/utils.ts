import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

/**
 * Format date to short format: dd/mm/yyyy
 * @param date - Date string or Date object
 * @returns Formatted date string (e.g., "22/06/2025")
 */
export function formatDateShort(date: string | Date): string {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function parseGallery(gallery: string): string[] {
  if (!gallery) return [];
  
  try {
    // Try parsing as JSON array
    const parsed = JSON.parse(gallery);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // If not JSON, treat as comma-separated
    return gallery.split(',').map((url) => url.trim()).filter(Boolean);
  }
}

/**
 * Decode URL-encoded description
 * @param description - Description có thể bị URL-encoded
 * @returns Description đã được decode
 */
export function decodeDescription(description: string | null | undefined): string {
  if (!description || typeof description !== 'string') {
    return '';
  }

  try {
    // Decode URL encoding (ví dụ: %3Cp%3E -> <p>, %20 -> space)
    const decoded = decodeURIComponent(description);
    return decoded;
  } catch (e) {
    // Nếu không phải URL-encoded hoặc có lỗi, trả về nguyên bản
    return description;
  }
}

/**
 * Format image URL based on product type
 * @param url - Image URL from database
 * @param productType - Product type ('jewelry', 'diamond', etc.)
 * @returns Formatted image URL
 */
export function formatImageUrl(url: string | null | undefined, productType?: string): string {
  if (!url) return '';
  
  // Nếu đã là full URL (bắt đầu với http:// hoặc https://), trả về nguyên bản
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Nếu là jewelry, thêm prefix
  if (productType === 'jewelry') {
    const baseUrl = 'https://admin.hebesbychloe.com/wp-content/uploads';
    // Đảm bảo URL không bắt đầu bằng / để tránh double slash
    const cleanUrl = url.startsWith('/') ? url.slice(1) : url;
    return `${baseUrl}/${cleanUrl}`;
  }
  
  // Các product type khác, trả về nguyên bản
  return url;
}

