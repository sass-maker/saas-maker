export const FLEET_QA_HEADER = "X-Fleet-QA";

const foodEventByTool = {
  search_food_products: "food.products_search_succeeded",
  get_food_product: "food.product_lookup_succeeded",
  search_vegetarian_recipes: "food.recipes_search_succeeded",
  get_vegetarian_recipe: "food.recipe_lookup_succeeded",
} as const;

type FoodTool = keyof typeof foodEventByTool;
export type FoodUsageEvent = typeof foodEventByTool[FoodTool];

export function foodEventForTool(tool: string): FoodUsageEvent | undefined {
  return Object.hasOwn(foodEventByTool, tool) ? foodEventByTool[tool as FoodTool] : undefined;
}
