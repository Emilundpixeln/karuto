import { url_to_ident, klu_data } from "./shared/klu_data.js";
import { collect, hook_message_updates, is_reply_to_command } from "./collector.js";
import { MessageHandler } from "./message_handler.js";
import { KARUTA_ID } from "./constants.js";



collect(async (m) => {
    if(m.author.id == KARUTA_ID
        && m.embeds.length > 0
        && (m.embeds[0].title == "Character Lookup" || (m.embeds[0].title == "Character Results" && await is_reply_to_command(m, ["lu", "lookup"])))) {
        m.react("🏷️");

        const collector = m.createReactionCollector({ filter: (react, user) => react.emoji.name == "🏷️" && user.id != m.client.user?.id, time: 30 * 1000, max: 1, maxEmojis: 1 });

        const msg = MessageHandler.as_message_reply(m);
        collector.on("collect", () => {
            hook_message_updates(m, (_) => {
                if(m.embeds.length == 0 || !m.embeds[0].description) return;
                const series = /Series · \*\*(.+)\*\*/g.exec(m.embeds[0].description);
                const char = /Character · \*\*(.+)\*\*/g.exec(m.embeds[0].description);

                if(!series || !char) return;
                const url = klu_data?.[series[1]]?.[char[1]];
                if(!url) {
                    msg.send(`**Aliases**: ${char}`);
                    return;
                }
                const ident = url_to_ident(url);
                const names = Object.entries(klu_data[series[1]]).filter((kv) => kv[1] && url_to_ident(kv[1] as string) == ident).map((kv) => kv[0]);

                msg.send(`**Aliases**: ${names.map((s) => `\`${s}\``).join(", ")}`);
            });
        });
    }
});
