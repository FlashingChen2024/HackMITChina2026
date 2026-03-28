import { post } from './client';

/**
 * 图片视觉识别透传（API v4.4 §9.1）。
 * `POST /api/v1/vision/analyze`
 *
 * @param {{ image_base64: string, compress_size_kb: number }} body
 * @returns {Promise<{ keywords_en?: string[], keywords_cn?: string[] }>}
 */
export function analyzeVision(body) {
  return post('/api/v1/vision/analyze', body);
}
