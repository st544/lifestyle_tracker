/**
 * USDA FoodData Central API client (fetch-based, no SDK — same approach as the
 * Anthropic + Strava clients so it stays Expo Go friendly).
 *
 * Docs: https://fdc.nal.usda.gov/api-guide.html
 * Get a free key at: https://fdc.nal.usda.gov/api-key-signup.html
 *
 * We only use the food search endpoint. Nutrient values from the search API are
 * normalized to **per 100 g** for the standard datasets, so we surface a
 * `per100` macro block and let the caller scale by grams eaten.
 */

import { FoodMacros } from '../types';

const BASE = 'https://api.nal.usda.gov/fdc/v1';

/** USDA nutrient numbers we care about. */
const NUTRIENT = {
  energyKcal: 1008,
  protein: 1003,
  carbs: 1005,
  fat: 1004,
} as const;

export class UsdaError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'UsdaError';
    this.status = status;
  }
}

export class MissingUsdaKeyError extends UsdaError {
  constructor() {
    super('No USDA API key set. Add one in Goals & Settings.');
    this.name = 'MissingUsdaKeyError';
  }
}

/** Simplified search result, macros normalized per 100 g. */
export interface UsdaFood {
  fdcId: number;
  description: string;
  brandName?: string;
  /** Macros per 100 g (the unit USDA search reports). */
  per100: FoodMacros;
  /** Manufacturer serving size, when provided (grams). */
  servingSize?: number;
  servingSizeUnit?: string;
}

interface RawFoodNutrient {
  nutrientId?: number;
  nutrientNumber?: string;
  value?: number;
}

interface RawFood {
  fdcId: number;
  description: string;
  brandName?: string;
  brandOwner?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: RawFoodNutrient[];
}

function nutrientValue(nutrients: RawFoodNutrient[] | undefined, id: number): number | undefined {
  if (!nutrients) return undefined;
  const match = nutrients.find(
    (n) => n.nutrientId === id || n.nutrientNumber === String(id),
  );
  return typeof match?.value === 'number' ? match.value : undefined;
}

function toUsdaFood(raw: RawFood): UsdaFood {
  const calories = nutrientValue(raw.foodNutrients, NUTRIENT.energyKcal) ?? 0;
  return {
    fdcId: raw.fdcId,
    description: raw.description,
    brandName: raw.brandName ?? raw.brandOwner,
    per100: {
      calories: Math.round(calories),
      proteinG: round1(nutrientValue(raw.foodNutrients, NUTRIENT.protein)),
      carbsG: round1(nutrientValue(raw.foodNutrients, NUTRIENT.carbs)),
      fatG: round1(nutrientValue(raw.foodNutrients, NUTRIENT.fat)),
    },
    servingSize: raw.servingSize,
    servingSizeUnit: raw.servingSizeUnit,
  };
}

/**
 * Search foods by query. Returns up to `pageSize` simplified results, filtered
 * to those that actually report calories (so the UI never shows a 0-kcal row).
 */
export async function searchFoods(
  query: string,
  apiKey: string,
  pageSize = 25,
): Promise<UsdaFood[]> {
  const key = apiKey?.trim();
  if (!key) throw new MissingUsdaKeyError();
  if (!query.trim()) return [];

  const url =
    `${BASE}/foods/search?api_key=${encodeURIComponent(key)}` +
    `&query=${encodeURIComponent(query.trim())}` +
    `&pageSize=${pageSize}` +
    // Prefer whole-food datasets first; they have clean per-100g values.
    `&dataType=${encodeURIComponent('Foundation,SR Legacy,Branded')}`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } });
  } catch (err: any) {
    throw new UsdaError(`Network error contacting USDA: ${err?.message ?? 'unknown'}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 403 || res.status === 401) {
      throw new UsdaError('USDA rejected the API key (403). Check it in Goals & Settings.', res.status);
    }
    throw new UsdaError(`USDA search failed (${res.status}): ${text.slice(0, 120)}`, res.status);
  }
  const data = await res.json();
  const foods: RawFood[] = Array.isArray(data?.foods) ? data.foods : [];
  return foods.map(toUsdaFood).filter((f) => f.per100.calories > 0);
}

/** Scale a per-100g macro block to `grams`, rounding to sensible precision. */
export function scaleMacros(per100: FoodMacros, grams: number): FoodMacros {
  const f = grams / 100;
  return {
    calories: Math.round(per100.calories * f),
    proteinG: round1((per100.proteinG ?? 0) * f),
    carbsG: round1((per100.carbsG ?? 0) * f),
    fatG: round1((per100.fatG ?? 0) * f),
  };
}

function round1(v: number | undefined): number | undefined {
  if (v == null || isNaN(v)) return undefined;
  return Math.round(v * 10) / 10;
}
