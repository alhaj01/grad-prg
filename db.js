import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const client = new MongoClient(uri);
let db;

export async function getDb() {
  if (!db) {
    await client.connect();
    db = client.db("restaurant_poc");
  }
  return db;
}

export const closeDb = () => client.close();
