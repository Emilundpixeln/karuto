import { MessageEmbed } from "discord.js";
import { collect, hook_message_updates, is_reply_to_command } from "./collector.js"
import { MessageHandler } from "./message_handler.js"
import { KARUTA_ID } from './constants.js'



collect(async (m) => {
    if(m.author.id == KARUTA_ID
        && m.embeds.length > 0
        && (m.embeds[0].title == "Character Lookup" || (m.embeds[0].title == "Character Results" && await is_reply_to_command(m, ["lu", "lookup"])))) {

        m.react("🖼");
        m.react("💰");
        let collector = m.createReactionCollector({ filter: (react, user) => react.emoji.name == "🖼" && user.id != m.client.user?.id, time: 30 * 1000, max: 1, maxEmojis: 1 });

        let msg = MessageHandler.as_message_reply(m);
        collector.on("collect", (r, u) => {
            hook_message_updates(m, (_) => {
                let image = m.embeds[0].image ?? m.embeds[0].thumbnail;
                image && msg.send({
                    embeds: [new MessageEmbed()
                        .setDescription(`https://gliding.codes/karuta?url=${encodeURIComponent(image.url)}`).setTitle("Karuta Frame Previewer & Tester")]
                })
            })
        });
    }
});
