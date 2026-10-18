import express from "express";
import { getDb } from "./db.js";
import { RESTAURANT_ID } from "./menu.js";

const app = express();
app.use(express.json());
app.use(express.static("public")); 

const STATUSES = ["new", "preparing", "ready", "done"];

app.get("/api/orders", async (req, res) => {
  try {
    const db = await getDb();
    const orders = await db
      .collection("orders")
      .find({ restaurantId: RESTAURANT_ID, status: { $ne: "done" } })
      .sort({ createdAt: 1 })
      .project({ _id: 0 })
      .toArray();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.patch("/api/orders/:orderId", async (req, res) => {
  try {
    const { status } = req.body;
    if (!STATUSES.includes(status)) return res.status(400).json({ error: "Invalid status" });
    const db = await getDb();
    const result = await db
      .collection("orders")
      .updateOne({ restaurantId: RESTAURANT_ID, orderId: req.params.orderId }, { $set: { status } });
    if (result.matchedCount === 0) return res.status(404).json({ error: "Order not found" });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log("Kitchen screen running at http://localhost:3000"));
