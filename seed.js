import { MENU, RESTAURANT_ID, embed, toDoc } from "./menu.js";
import { getDb, closeDb } from "./db.js";

const db = await getDb();
const menu = db.collection("menu");

console.log("Embedding menu items...");
const vectors = await embed(MENU.map(toDoc));

await menu.deleteMany({ restaurantId: RESTAURANT_ID });
await menu.insertMany(
  MENU.map((item, i) => ({
    ...item,
    restaurantId: RESTAURANT_ID,
    available: true,
    embedding: vectors[i],
  }))
);
await menu.createIndex({ restaurantId: 1, id: 1 }, { unique: true });

console.log(`Seeded ${MENU.length} menu items into MongoDB.`);
await closeDb();
