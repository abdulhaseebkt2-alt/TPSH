import { openModal } from '../lib/dialog.js';

/**
 * Interactive 3:3 (1:1 Square) Image Cropper Modal
 * Allows panning, zooming, and precision cropping to 1:1 aspect ratio.
 */
export function openCropModal({ imageUrl, title, onCropped, onCancel }) {
  const img = new Image();
  img.crossOrigin = 'anonymous';

  img.onload = () => {
    let scale = 1;
    let minScale = 0.2;
    let maxScale = 5;
    let offsetX = 0;
    let offsetY = 0;
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    const CROP_SIZE = 260; // Size of square crop area on canvas (1:1 / 3:3)
    const CANVAS_WIDTH = 380;
    const CANVAS_HEIGHT = 340;

    const cropX = (CANVAS_WIDTH - CROP_SIZE) / 2;
    const cropY = (CANVAS_HEIGHT - CROP_SIZE) / 2;

    // Default scale: fill the square crop area
    const initialFitScale = Math.max(CROP_SIZE / img.width, CROP_SIZE / img.height);
    scale = initialFitScale;
    minScale = initialFitScale * 0.7;
    maxScale = initialFitScale * 4;

    const { close } = openModal({
      title: title || 'Crop Institution Logo — 3:3 (1:1 Square)',
      contentHtml: `
        <div style="display: flex; flex-direction: column; gap: 1rem; align-items: center;">
          <div style="width: 100%; display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: var(--text-muted); background: var(--bg-surface-subtle); padding: 0.5rem 0.85rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); flex-wrap: wrap; gap: 0.5rem;">
            <div>Original Dimensions: <strong>${img.width} × ${img.height} px</strong></div>
            <div style="color: #059669; font-weight: 700;">Target Ratio: 3:3 (1:1 Square) or Original</div>
          </div>

          <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
            <canvas id="crop-canvas" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" style="background: #0F172A; border-radius: var(--radius-md); cursor: grab; max-width: 100%; box-shadow: 0 4px 14px rgba(0,0,0,0.2); touch-action: none;"></canvas>
            <div style="position: absolute; bottom: 8px; left: 12px; font-size: 0.7rem; color: rgba(255,255,255,0.7); pointer-events: none;">
              Drag to pan • Scroll to zoom
            </div>
          </div>

          <!-- Zoom Slider & Controls -->
          <div style="width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1;">
              <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">Zoom:</span>
              <button class="btn btn-sm btn-outline" id="btn-zoom-out" style="padding: 0.2rem 0.5rem;">−</button>
              <input type="range" id="crop-zoom-slider" min="50" max="300" value="100" style="flex: 1; accent-color: var(--brand-primary); cursor: pointer;" />
              <button class="btn btn-sm btn-outline" id="btn-zoom-in" style="padding: 0.2rem 0.5rem;">+</button>
            </div>
            <button class="btn btn-sm btn-secondary" id="btn-center-crop">Fit Center</button>
          </div>

          <!-- Live Preview Thumbnail & Actions -->
          <div style="width: 100%; display: flex; align-items: center; justify-content: space-between; padding-top: 0.75rem; border-top: 1px solid var(--border-subtle); flex-wrap: wrap; gap: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <canvas id="crop-preview-canvas" width="56" height="56" style="border-radius: var(--radius-md); border: 2px solid #059669; box-shadow: var(--shadow-sm); background: #FFFFFF;"></canvas>
              <div>
                <strong style="font-size: 0.78rem; display: block;">Sidebar & Header Preview</strong>
                <span style="font-size: 0.7rem; color: var(--text-muted);">Exact 3:3 (1:1) square icon</span>
              </div>
            </div>

            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: flex-end;">
              <button class="btn btn-outline" id="crop-cancel-btn">Cancel</button>
              <button class="btn btn-secondary" id="crop-use-original-btn" title="Skip cropping and use full image as-is">
                Use Full / Original (No Crop)
              </button>
              <button class="btn btn-primary" id="crop-apply-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Apply 3:3 Crop
              </button>
            </div>
          </div>
        </div>
      `,
      onMount: ({ container }) => {
        const canvas = container.querySelector('#crop-canvas');
        const ctx = canvas.getContext('2d');
        const previewCanvas = container.querySelector('#crop-preview-canvas');
        const prevCtx = previewCanvas.getContext('2d');
        const zoomSlider = container.querySelector('#crop-zoom-slider');

        function render() {
          ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

          // Draw image
          ctx.save();
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          const drawX = (CANVAS_WIDTH - drawW) / 2 + offsetX;
          const drawY = (CANVAS_HEIGHT - drawH) / 2 + offsetY;
          ctx.drawImage(img, drawX, drawY, drawW, drawH);
          ctx.restore();

          // Draw dark vignette overlay outside the crop box
          ctx.save();
          ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
          // Top
          ctx.fillRect(0, 0, CANVAS_WIDTH, cropY);
          // Bottom
          ctx.fillRect(0, cropY + CROP_SIZE, CANVAS_WIDTH, CANVAS_HEIGHT - (cropY + CROP_SIZE));
          // Left
          ctx.fillRect(0, cropY, cropX, CROP_SIZE);
          // Right
          ctx.fillRect(cropX + CROP_SIZE, cropY, CANVAS_WIDTH - (cropX + CROP_SIZE), CROP_SIZE);

          // Draw crop border
          ctx.strokeStyle = '#10B981';
          ctx.lineWidth = 2;
          ctx.strokeRect(cropX, cropY, CROP_SIZE, CROP_SIZE);

          // Draw rule-of-thirds grid
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);

          const third = CROP_SIZE / 3;
          // Verticals
          ctx.beginPath();
          ctx.moveTo(cropX + third, cropY);
          ctx.lineTo(cropX + third, cropY + CROP_SIZE);
          ctx.moveTo(cropX + third * 2, cropY);
          ctx.lineTo(cropX + third * 2, cropY + CROP_SIZE);
          // Horizontals
          ctx.moveTo(cropX, cropY + third);
          ctx.lineTo(cropX + CROP_SIZE, cropY + third);
          ctx.moveTo(cropX, cropY + third * 2);
          ctx.lineTo(cropX + CROP_SIZE, cropY + third * 2);
          ctx.stroke();
          ctx.restore();

          // Render live square preview thumbnail
          renderLivePreview();
        }

        function renderLivePreview() {
          prevCtx.clearRect(0, 0, 56, 56);
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          const imgLeft = (CANVAS_WIDTH - drawW) / 2 + offsetX;
          const imgTop = (CANVAS_HEIGHT - drawH) / 2 + offsetY;

          const sourceX = (cropX - imgLeft) / scale;
          const sourceY = (cropY - imgTop) / scale;
          const sourceDim = CROP_SIZE / scale;

          prevCtx.drawImage(img, sourceX, sourceY, sourceDim, sourceDim, 0, 0, 56, 56);
        }

        function getCroppedDataUrl() {
          const exportCanvas = document.createElement('canvas');
          exportCanvas.width = 512;
          exportCanvas.height = 512;
          const expCtx = exportCanvas.getContext('2d');

          const drawW = img.width * scale;
          const drawH = img.height * scale;
          const imgLeft = (CANVAS_WIDTH - drawW) / 2 + offsetX;
          const imgTop = (CANVAS_HEIGHT - drawH) / 2 + offsetY;

          const sourceX = (cropX - imgLeft) / scale;
          const sourceY = (cropY - imgTop) / scale;
          const sourceDim = CROP_SIZE / scale;

          expCtx.drawImage(img, sourceX, sourceY, sourceDim, sourceDim, 0, 0, 512, 512);
          return exportCanvas.toDataURL('image/png');
        }

        // Pointer Drag / Pan handlers
        canvas.addEventListener('mousedown', (e) => {
          isDragging = true;
          startX = e.clientX - offsetX;
          startY = e.clientY - offsetY;
          canvas.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', (e) => {
          if (!isDragging) return;
          offsetX = e.clientX - startX;
          offsetY = e.clientY - startY;
          render();
        });

        window.addEventListener('mouseup', () => {
          isDragging = false;
          canvas.style.cursor = 'grab';
        });

        // Touch support for mobile / touchpads
        canvas.addEventListener('touchstart', (e) => {
          if (e.touches.length === 1) {
            isDragging = true;
            startX = e.touches[0].clientX - offsetX;
            startY = e.touches[0].clientY - offsetY;
          }
        }, { passive: true });

        canvas.addEventListener('touchmove', (e) => {
          if (isDragging && e.touches.length === 1) {
            offsetX = e.touches[0].clientX - startX;
            offsetY = e.touches[0].clientY - startY;
            render();
          }
        }, { passive: true });

        canvas.addEventListener('touchend', () => {
          isDragging = false;
        });

        // Scroll Zoom
        canvas.addEventListener('wheel', (e) => {
          e.preventDefault();
          const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
          const nextScale = Math.min(Math.max(scale * zoomFactor, minScale), maxScale);
          scale = nextScale;
          zoomSlider.value = Math.round((scale / initialFitScale) * 100);
          render();
        }, { passive: false });

        // Slider Zoom
        zoomSlider.addEventListener('input', () => {
          const factor = Number(zoomSlider.value) / 100;
          scale = initialFitScale * factor;
          render();
        });

        container.querySelector('#btn-zoom-in')?.addEventListener('click', () => {
          scale = Math.min(scale * 1.15, maxScale);
          zoomSlider.value = Math.round((scale / initialFitScale) * 100);
          render();
        });

        container.querySelector('#btn-zoom-out')?.addEventListener('click', () => {
          scale = Math.max(scale * 0.85, minScale);
          zoomSlider.value = Math.round((scale / initialFitScale) * 100);
          render();
        });

        container.querySelector('#btn-center-crop')?.addEventListener('click', () => {
          scale = initialFitScale;
          offsetX = 0;
          offsetY = 0;
          zoomSlider.value = 100;
          render();
        });

        container.querySelector('#crop-cancel-btn')?.addEventListener('click', () => {
          close();
          if (onCancel) onCancel();
        });

        container.querySelector('#crop-use-original-btn')?.addEventListener('click', () => {
          close();
          if (onCropped) onCropped(imageUrl);
        });

        container.querySelector('#crop-apply-btn')?.addEventListener('click', () => {
          const croppedDataUrl = getCroppedDataUrl();
          close();
          if (onCropped) onCropped(croppedDataUrl);
        });

        // Initial render
        render();
      }
    });
  };

  img.src = imageUrl;
}
