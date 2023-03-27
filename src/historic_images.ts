import { url_to_ident, url_to_ed, ident_to_url } from "./shared/klu_data.js"
import { collect_by_prefix, hook_message_updates, is_reply_to_command } from "./collector.js"
import { MessageHandler } from "./message_handler.js"
import { KARUTA_ID } from './constants.js' 


 
collect_by_prefix("ohistory", async (m, cont) => {
    if(!m.reference) return

    let ref = await m.fetchReference();

    if(ref.author.id == KARUTA_ID
    && ref.embeds.length > 0
    && (ref.embeds[0].title == "Character Lookup" || (ref.embeds[0].title == "Character Results" && await is_reply_to_command(ref, [ "lu", "lookup" ]))))
{

    let msg = MessageHandler.as_message_reply(ref);
    hook_message_updates(ref, (_) => {
        if(ref.embeds.length == 0) return;

        let url = ref.embeds[0]?.thumbnail?.url ?? ref.embeds[0]?.image?.url;
        if(!url) return;
        let ident = url_to_ident(url);
        let ed = url_to_ed(url)
        let match = /-(\d+)\./g.exec(url);
        if(!url.includes("http://d2l56h9h5tj8ue.cloudfront.net/images/cards/versioned/") || !match || !ed) {
            msg.send("No old images");
        } else {
            let max = parseInt(match[1]);

            msg.send(`Old images: \n${ident_to_url(ident, ed, false)}\n${new Array(max - 1).fill(null).map((_, i) => ident_to_url(ident, ed!, true, i + 1)).join("\n")}`)
        }
    })
    
}
});
