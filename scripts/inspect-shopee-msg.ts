import "dotenv/config";
import { getConnectedShops } from "../server/shopee";
import { listConversations, getMessages } from "../server/shopee-chat";

async function main() {
  const shops = await getConnectedShops();
  if (shops.length === 0) return;
  const shop = shops[0];
  const convs = await listConversations(shop, 1);
  if (convs.length === 0) return;
  console.log("conv ts:", convs[0].last_message_timestamp, "as Date(/1):", new Date(convs[0].last_message_timestamp));
  const msgs = await getMessages(shop, convs[0].conversation_id, 3);
  for (const m of msgs.slice(0, 3)) {
    console.log("msg ts:", m.created_timestamp, "as Date(/1):", new Date(Number(m.created_timestamp)), "/1000:", new Date(Number(m.created_timestamp) * 1000));
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
