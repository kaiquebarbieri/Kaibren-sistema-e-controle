import "dotenv/config";
import { getConnectedShops } from "../server/shopee";
import { listConversations } from "../server/shopee-chat";

async function main() {
  const shops = await getConnectedShops();
  for (const shop of shops) {
    console.log(`\n=== ${shop.shopName} ===`);
    const convs = await listConversations(shop, 50);
    console.log(`Total retornado: ${convs.length}`);
    console.log(`\nLucas filtrado:`);
    const lucas = convs.filter(c => (c.to_name || "").toLowerCase().includes("lucas"));
    console.log(JSON.stringify(lucas, null, 2));
    console.log(`\nTodas conversas com unread > 0:`);
    const unread = convs.filter(c => c.unread_count > 0);
    console.log(`  ${unread.length} conversas com mensagens não lidas`);
    for (const c of unread) {
      console.log(`  - ${c.to_name} (id ${c.to_id}) unread=${c.unread_count} latest="${c.latest_message_content?.text?.slice(0, 80) || JSON.stringify(c.latest_message_content)?.slice(0, 80)}"`);
    }
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
