import { getDb, closeDb } from "./db.js";
import { RESTAURANT_ID } from "./menu.js";

export async function createOrder({ items, customerName, orderType = "pickup" }) {
  if (!Array.isArray(items) || items.length === 0)
    return { ok: false, error: "Order has no items." };
  if (!customerName) return { ok: false, error: "Customer name is required." };
  if (!["pickup", "delivery"].includes(orderType))
    return { ok: false, error: "orderType must be pickup or delivery." };

  const db = await getDb();

  const lines = [];
  for (const { itemId, qty } of items) {
    const menuItem = await db
      .collection("menu")
      .findOne({ restaurantId: RESTAURANT_ID, id: itemId });
    if (!menuItem) return { ok: false, error: `Unknown item id: ${itemId}` };
    if (!menuItem.available) return { ok: false, error: `${menuItem.name} is not available right now.` };
    if (!Number.isInteger(qty) || qty < 1 || qty > 20)
      return { ok: false, error: `Invalid quantity for ${menuItem.name}.` };
    lines.push({
      itemId,
      name: menuItem.name,
      qty,
      unitPrice: menuItem.price, 
      lineTotal: +(menuItem.price * qty).toFixed(2),
    });
  }

  const total = +lines.reduce((sum, l) => sum + l.lineTotal, 0).toFixed(2);
  const count = await db.collection("orders").countDocuments({ restaurantId: RESTAURANT_ID });

  const order = {
    orderId: `ORD-${count + 1}`,
    restaurantId: RESTAURANT_ID,
    customerName,
    orderType,
    items: lines,
    total,
    status: "new",
    createdAt: new Date().toISOString(),
  };
  await db.collection("orders").insertOne({ ...order }); 

  return { ok: true, order };
}


if (process.argv[1].endsWith("orders.js")) {
  console.log("Test 1: valid order");
  console.log(
    JSON.stringify(
      await createOrder({
        items: [{ itemId: "b1", qty: 1 }, { itemId: "d1", qty: 2 }],
        customerName: "Ahmed",
      }),
      null,
      2
    )
  );
  console.log("\nTest 2: invented item (should be rejected)");
  console.log(await createOrder({ items: [{ itemId: "x99", qty: 1 }], customerName: "Ahmed" }));
  console.log("\nTest 3: bad quantity (should be rejected)");
  console.log(await createOrder({ items: [{ itemId: "b1", qty: 0 }], customerName: "Ahmed" }));
  await closeDb();
}
