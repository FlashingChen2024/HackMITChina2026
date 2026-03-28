/**
 * 检测当前浏览器是否支持通过 canvas 编码为 WebP。
 *
 * @returns {boolean}
 */
function isCanvasWebpEncodeSupported() {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const sample = canvas.toDataURL('image/webp', 0.8);
    return typeof sample === 'string' && sample.startsWith('data:image/webp');
  } catch {
    return false;
  }
}

/**
 * 将图片压成 **WebP**（优先）并输出带前缀的 data URL，再供 §9.1 作为 `image_base64` 上传。
 * 不支持 WebP 编码时回退为 JPEG（`data:image/jpeg;base64,...`）。
 *
 * @param {string} dataUrl 摄像头截图等 Data URL
 * @param {{ maxEdge?: number, maxBytes?: number, initialQuality?: number, webpInitialQuality?: number, jpegInitialQuality?: number }} [opts]
 * @returns {Promise<{ image_base64: string, compress_size_kb: number }>}
 */
export function compressDataUrlForVision(dataUrl, opts = {}) {
  const maxEdge = opts.maxEdge ?? 960;
  const maxBytes = opts.maxBytes ?? 140 * 1024;
  const useWebp = isCanvasWebpEncodeSupported();
  const mime = useWebp ? 'image/webp' : 'image/jpeg';
  let quality = opts.initialQuality
    ?? (useWebp ? (opts.webpInitialQuality ?? 0.82) : (opts.jpegInitialQuality ?? 0.72));
  const minQuality = useWebp ? 0.42 : 0.38;

  /**
   * @param {number} q
   * @param {number} edge
   * @returns {Promise<string>} data URL（webp 或 jpeg）
   */
  const toEncodedDataUrl = (q, edge) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (!w || !h) {
          reject(new Error('图片尺寸无效'));
          return;
        }
        if (w > edge || h > edge) {
          if (w >= h) {
            h = Math.round((h * edge) / w);
            w = edge;
          } else {
            w = Math.round((w * edge) / h);
            h = edge;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('无法创建画布上下文'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);

        let out = canvas.toDataURL(mime, q);
        if (useWebp && !out.startsWith('data:image/webp')) {
          out = canvas.toDataURL('image/jpeg', q);
        }
        resolve(out);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = dataUrl;
  });

  return (async () => {
    let dataUrlOut = await toEncodedDataUrl(quality, maxEdge);
    const sliceB64 = (u) => (u.includes(',') ? u.slice(u.indexOf(',') + 1) : u);
    let b64 = sliceB64(dataUrlOut);
    let bytes = Math.floor((b64.length * 3) / 4);
    while (bytes > maxBytes && quality > minQuality) {
      quality -= 0.06;
      dataUrlOut = await toEncodedDataUrl(quality, maxEdge);
      b64 = sliceB64(dataUrlOut);
      bytes = Math.floor((b64.length * 3) / 4);
    }
    const image_base64 = dataUrlOut.startsWith('data:')
      ? dataUrlOut
      : (mime === 'image/webp'
        ? `data:image/webp;base64,${b64}`
        : `data:image/jpeg;base64,${b64}`);
    const compress_size_kb = Math.max(1, Math.round(bytes / 1024));
    return { image_base64, compress_size_kb };
  })();
}
