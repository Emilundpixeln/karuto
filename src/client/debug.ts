import { MessageEmbed, TextBasedChannel } from "discord.js";
import { collect_by_prefix } from "./collector.js";


collect_by_prefix("ojson", async (m, cont) => {

    const match = /https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/g.exec(cont);
    if(!match) {
        m.reply("Provide a link to message");
        return;
    }

    const channel = m.client.channels.cache.get(match[2]);

    if(!channel || !channel.isText()) return;
    const msg = await (channel as TextBasedChannel).messages.fetch(match[3]);

    const str = JSON.stringify(msg, null, 2);
    m.reply({ embeds: [new MessageEmbed().setDescription(`\`\`\`\n${str.substr(0, 3800).replaceAll("```", "\\`\\`\\`")}\n\`\`\``)] });
});

