// Institutional & Mobile Logo Utilities

export function isValidImageUri(uri) {
  if (!uri || typeof uri !== 'string') return false;
  const s = uri.trim();
  if (s.startsWith('data:image/') && s.length > 50 && s.includes(';base64,')) {
    return true;
  }
  if (s.startsWith('/') || s.startsWith('./') || s.startsWith('http://') || s.startsWith('https://')) {
    return true;
  }
  return false;
}

export function getSavedLogo(key = 'tps_institution_logo') {
  if (typeof localStorage === 'undefined') return '';
  let raw = localStorage.getItem(key);
  if (!raw || raw === 'null' || raw === 'undefined') return '';
  if (typeof raw === 'string') {
    raw = raw.trim();
    while ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'string') {
          raw = parsed.trim();
        } else {
          break;
        }
      } catch (e) {
        raw = raw.slice(1, -1).trim();
      }
    }
  }
  if (!raw || raw === 'null' || raw === 'undefined') return '';
  if (!isValidImageUri(raw)) return '';
  return raw;
}

export function sanitizeLogoValue(val) {
  if (!val || val === 'null' || val === 'undefined') return null;
  if (typeof val === 'string') {
    let raw = val.trim();
    while ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'string') {
          raw = parsed.trim();
        } else {
          break;
        }
      } catch (e) {
        raw = raw.slice(1, -1).trim();
      }
    }
    if (!raw || raw === 'null' || raw === 'undefined') return null;
    if (!isValidImageUri(raw)) return null;
    return raw;
  }
  return val;
}

/**
 * High-performance browser-based image optimizer & compressor
 * Downscales high-resolution camera photos to mobile-retina dimensions
 * Preserves transparency and aspect ratio, avoiding LocalStorage Quota Exceeded errors.
 */
export function optimizeLogoImage(file, { maxWidth = 800, maxHeight = 320, quality = 0.9 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file provided'));

    // If it's an SVG file, read directly as text/data-url without rasterizing
    if (file.type === 'image/svg+xml') {
      const svgReader = new FileReader();
      svgReader.onload = (e) => resolve(e.target.result);
      svgReader.onerror = () => reject(new Error('Failed to read SVG logo'));
      svgReader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result;
      if (typeof Image === 'undefined' || typeof document === 'undefined') {
        return resolve(dataUrl);
      }

      const img = new Image();
      img.onerror = () => reject(new Error('Image could not be decoded. Please select a valid PNG, JPG, or WebP.'));
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width <= 0 || height <= 0) {
          return resolve(dataUrl);
        }

        // Calculate proportional downscale
        let scale = 1;
        if (width > maxWidth || height > maxHeight) {
          const wRatio = maxWidth / width;
          const hRatio = maxHeight / height;
          scale = Math.min(wRatio, hRatio);
        }

        const targetW = Math.max(1, Math.round(width * scale));
        const targetH = Math.max(1, Math.round(height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          return resolve(dataUrl);
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetW, targetH);

        // Try WebP first for optimal compression and alpha support, fallback to PNG
        try {
          const webpUrl = canvas.toDataURL('image/webp', quality);
          if (webpUrl && webpUrl.startsWith('data:image/webp') && webpUrl.length < dataUrl.length) {
            return resolve(webpUrl);
          }
        } catch (e) {
          // ignore webp fallback
        }

        const pngUrl = canvas.toDataURL('image/png');
        resolve(pngUrl);
      };

      img.src = dataUrl;
    };

    reader.readAsDataURL(file);
  });
}

