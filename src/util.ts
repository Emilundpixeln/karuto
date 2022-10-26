import { collect_by_prefix } from "./collector.js"

collect_by_prefix("ocache", async (m, cont) => {
    let a = await m.channel.messages.fetch();
    console.log(a.lastKey());
});