import "dotenv/config";
import { runCurator } from "../server/agents/sam-chat/curator";

runCurator()
  .then((r) => {
    console.log("Curator OK:", r);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
