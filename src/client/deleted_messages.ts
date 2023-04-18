import { collect_message_delete } from "./collector.js";

collect_message_delete((m) => m.author?.id != m.client.user?.id, (m) => {
    console.log("A Message was deleted!");
    console.log(m);
});