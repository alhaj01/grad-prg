import { pipeline } from "@huggingface/transformers";
import { getDb, closeDb } from "./db.js";

export const RESTAURANT_ID = "r1";

export const MENU = [
  { id: "b1", name: "Nashville Hot Chicken Burger", price: 9.5, category: "Burgers", description: "Crispy spicy fried chicken, pickles, slaw", allergens: ["gluten", "dairy"] },
  { id: "b2", name: "Classic Beef Burger", price: 8.5, category: "Burgers", description: "Beef patty, cheddar, lettuce, tomato", allergens: ["gluten", "dairy"] },
  { id: "b3", name: "Veggie Burger", price: 8.0, category: "Burgers", description: "Chickpea and vegetable patty, vegan mayo", allergens: ["gluten"] },
  { id: "b4", name: "Double Smash Burger", price: 11.0, category: "Burgers", description: "Two smashed beef patties, American cheese, special sauce", allergens: ["gluten", "dairy"] },
  { id: "s1", name: "Chicken Shawarma Wrap", price: 6.5, category: "Wraps", description: "Marinated chicken, garlic sauce, pickles", allergens: ["gluten", "sesame"] },
  { id: "s2", name: "Falafel Wrap", price: 5.0, category: "Wraps", description: "Falafel, tahini, tomato, parsley. Vegan", allergens: ["gluten", "sesame"] },
  { id: "p1", name: "Margherita Pizza", price: 10.0, category: "Pizza", description: "Tomato, mozzarella, basil. Vegetarian", allergens: ["gluten", "dairy"] },
  { id: "p2", name: "Pepperoni Pizza", price: 12.0, category: "Pizza", description: "Tomato, mozzarella, beef pepperoni", allergens: ["gluten", "dairy"] },
  { id: "f1", name: "French Fries", price: 3.0, category: "Sides", description: "Crispy salted fries. Vegan, gluten free", allergens: [] },
  { id: "f2", name: "Onion Rings", price: 3.5, category: "Sides", description: "Beer-battered onion rings", allergens: ["gluten"] },
  { id: "f3", name: "Caesar Salad", price: 6.0, category: "Sides", description: "Romaine, parmesan, croutons, caesar dressing", allergens: ["gluten", "dairy", "egg"] },
  { id: "d1", name: "Cola", price: 1.5, category: "Drinks", description: "Cold cola can", allergens: [] },
  { id: "d2", name: "Orange Juice", price: 2.5, category: "Drinks", description: "Fresh squeezed orange juice", allergens: [] },
  { id: "d3", name: "Bottled Water", price: 1.0, category: "Drinks", description: "Still mineral water", allergens: [] },
  { id: "e1", name: "Chocolate Brownie", price: 4.0, category: "Desserts", description: "Warm chocolate brownie with walnuts", allergens: ["gluten", "dairy", "egg", "nuts"] },
];

// One text "document" per item: this is what gets embedded
export const toDoc = (i) =>
  `${i.name}. ${i.description}. Category: ${i.category}. Contains: ${i.allergens.join(", ") || "no major allergens"}.`;

// Local embedding model (no API key)
let extractor;
export async function embed(texts) {
  extractor ??= await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  const out = await extractor(texts, { pooling: "mean", normalize: true });
  return out.tolist();
}

// Vectors are normalized, so dot product = cosine similarity
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);

// THE RAG RETRIEVAL STEP (now reads from the Menu DB in MongoDB)
export async function searchMenu(query, topK = 3) {
  const db = await getDb();
  const items = await db
    .collection("menu")
    .find({ restaurantId: RESTAURANT_ID, available: true })
    .toArray();
  const [q] = await embed([query]);
  return items
    .map(({ _id, embedding, ...item }) => ({ ...item, score: +dot(q, embedding).toFixed(3) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// Quick test from the terminal
if (process.argv[1].endsWith("menu.js")) {
  const query = process.argv.slice(2).join(" ") || "spicy chicken sandwich";
  console.log(`Query: "${query}"\n`);
  const results = await searchMenu(query);
  console.table(results.map(({ id, name, price, score }) => ({ id, name, price, score })));
  await closeDb();
}
