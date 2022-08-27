import { MessageEmbed, TextBasedChannel } from "discord.js";
import { collect_by_prefix } from "./collector.js"


collect_by_prefix("ojson", async (m, cont) => {

    let match = /https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/g.exec(cont);
    if(!match) 
    {
        m.reply("Provide a link to message");
        return;
    }

    let channel = await m.client.channels.cache.get(match[2]);

    if(!channel.isText()) return;
    let msg = await (channel as TextBasedChannel).messages.fetch(match[3]);

    let str = JSON.stringify(msg, null, 2);
    m.reply(str.length < 3800 ? { embeds: [ new MessageEmbed().setDescription(`\`\`\`\n${str}\n\`\`\``) ] } : "JSON to large 😭");
} )