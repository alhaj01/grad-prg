import OpenAI from "openai";
import readline from "readline/promises";
import { searchMenu } from "./menu.js";
import { createOrder } from "./orders.js";

const client = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});
const MODEL = process.env.MODEL || "gemini-3.8-flash";

const SYSTEM_PROMPT = `You are a friendly phone-ordering assistant for a restaurant.
Rules:
- Keep replies short (1-2 sentences), like a real phone call. Ask one question at a time.
- ALWAYS use the searchMenu tool to find items. Never mention an item or price that did not come from searchMenu.
- If searchMenu returns nothing close to what the customer asked, say you don't have it and offer alternatives from the results.
- For allergy questions, only answer from the allergens in the search results. If unsure, say so.
- When the customer seems done, read back the full order with quantities and the total, then ask them to confirm.
- Get the customer's name and whether it is pickup or delivery before placing the order.
- Only call createOrder AFTER the customer clearly confirms the read-back.
- After createOrder succeeds, give the order number and total, then say goodbye.`;

const tools = [
  {
    type: "function",
    function: {
      name: "searchMenu",
      description: "Search the menu by meaning. Use for any item, ingredient, dietary or allergy question.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "What the customer asked for" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "createOrder",
      description: "Place the final order. Only call after the customer confirmed the read-back.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                itemId: { type: "string", description: "id from searchMenu results" },
                qty: { type: "integer" },
              },
              required: ["itemId", "qty"],
            },
          },
          customerName: { type: "string" },
          orderType: { type: "string", enum: ["pickup", "delivery"] },
        },
        required: ["items", "customerName", "orderType"],
      },
    },
  },
];


async function runTool(name, args) {
  if (name === "searchMenu") {
    const results = await searchMenu(args.query, 4);
    return results.map(({ id, name, price, description, allergens, score }) => ({
      id, name, price, description, allergens, score,
    }));
  }
  if (name === "createOrder") return createOrder(args);
  return { error: `Unknown tool ${name}` };
}

const messages = [{ role: "system", content: SYSTEM_PROMPT }];


async function respond() {
  for (let step = 0; step < 6; step++) {
    const res = await callModel();
    const msg = res.choices[0].message;
    messages.push(msg);

    if (!msg.tool_calls?.length) return msg.content;

    for (const call of msg.tool_calls) {
      const args = JSON.parse(call.function.arguments || "{}");
      console.log(`   [tool] ${call.function.name}(${JSON.stringify(args)})`);
      const result = await runTool(call.function.name, args);
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  return "Sorry, something went wrong. Could you repeat that?";
}


const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
console.log("Restaurant agent ready. Type as the customer. Ctrl+C to quit.\n");
console.log("Agent: Hi! Thanks for calling. What can I get for you today?\n");
messages.push({ role: "assistant", content: "Hi! Thanks for calling. What can I get for you today?" });

while (true) {
  const input = await rl.question("You: ");
  if (!input.trim()) continue;
  messages.push({ role: "user", content: input });
  try {
    console.log(`\nAgent: ${await respond()}\n`);
  } catch (err) {
    console.error("Error:", err.message);
  }
}
