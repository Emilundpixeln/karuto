import { collect } from './collector.js';
import { Client, MessageButton } from 'discord.js';
import { KARUTA_ID } from "./constants.js"

collect((msg) => {
    if(msg.author.id != KARUTA_ID) return;
    if(msg.channelId != "932713994886721576") return;
    if(msg.content && (msg.content.endsWith("is dropping 3 cards!") || msg.content == "I'm dropping 3 cards since this server is currently active!")) {
        let has_candy = msg.components.some((comp) => comp.components.some(c => !!(c as MessageButton).emoji?.name && /stEgg\d+a/g.exec((c as MessageButton).emoji!.name!)));
        if(!has_candy) return;
        console.log("has candy", msg);
        let collector = msg.channel.createMessageCollector();

        let other = false;
        collector.on("collect", async (message) => {
            if(message.author.id == KARUTA_ID && /<@\d+>, you /g.exec(message.content))
                other = true;
        });
        setTimeout(() => {
            if(!other) {
                msg.reply("Egg Drop! <@&1007998487968886824>");
            }
        }, 10 * 1000);
    }
});