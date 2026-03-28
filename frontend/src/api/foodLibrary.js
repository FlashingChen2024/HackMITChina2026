import { get } from './client';

/**
 * 食物库模糊匹配（API v4.4 §9.2）。
 * `GET /api/v1/food-library/search?keyword=`
 *
 * @param {string} keyword
 * @returns {Promise<{ keyword?: string, matches?: { food_code: string, food_name_cn: string, default_unit_cal_per_100g: number }[] }>}
 */
export function searchFoodLibrary(keyword) {
  const params = new URLSearchParams({ keyword: String(keyword).trim() });
  return get(`/api/v1/food-library/search?${params}`);
}
