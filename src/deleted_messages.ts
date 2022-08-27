import { collect_message_delete } from "./collector.js"

collect_message_delete(() => true, (m) => {
    console.log("A Message was deleted!");
    console.log(m);
})