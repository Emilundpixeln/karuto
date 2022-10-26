import { MessageEmbed, TextBasedChannel } from 'discord.js';
import { on_client_available, collect, collect_by_prefix } from './collector.js';
import { readFileSync, writeFileSync } from "fs"
import { Message } from "discord.js"
import ls from 'js-levenshtein';
import { KARUTA_ID } from './constants.js'

type Card = {
    char: string,
    series: string
};

let store: {
    after: { [key: string]: string },
    users: { [key: string]: { [key: string]: Card } };
};



let process_message = (message: Message<boolean>): boolean => {


   // console.log(message.embeds.length > 0 && message.embeds[0].description)
    if(!(message.embeds.length > 0 && message.author.id == KARUTA_ID && message.embeds[0].description
        && message.embeds[0].description.startsWith("Cards carried by"))) return false;



    let text = message.embeds[0].description.split("\n").slice(2);
    let user = /<@(\d+)>/g.exec(message.embeds[0].description)[1];
    let cards = store.users[user];
    if(cards == undefined) {
        cards = {};
        store.users[user] = cards;
    }
  
    text.map((s, i) => {

        let parts = s.replaceAll("~~", "").split("·");
        if(parts.length == 1) return;
        if(parts.length < 6) {
            console.error("parse error", parts);
            return
        }
        let id = /` *([a-z0-9]+)`/g.exec(parts[parts.length - 6]);
        if(!id) {
            console.log(parts, "id error");
            return;
        }
        cards[id[1]] = {
            char: parts[parts.length - 1].substr(3, parts[parts.length - 1].length - 3 - 2),
            series: parts[parts.length - 2].trim()
        };
    });
    return true;
}

let save_store = () => {
    writeFileSync("ids.json", JSON.stringify(store));
}

let min_snowflake = (a: string, b: string) => {
    return !a || a < b || a.length < b.length ? a : b;
}

let search_channels = [ "932713994886721576" ];

on_client_available(async (client) => {
    store = JSON.parse(readFileSync("ids.json", { encoding: "utf-8"}));
    if(!store.after) store.after = {};
    if(!store.users) store.users = {};
    for(let channelId of search_channels) {
        let channel = await client.channels.fetch(channelId) as TextBasedChannel;

        let before = "9223372036854775807";

        for(let i = 0; i < 30; i++) {

            let msgs = await channel.messages.fetch({ before, limit: 100 });
     
            for (const msg of msgs) {
    
                before = min_snowflake(before, msg[0]);
        
                process_message(msg[1]);
                
            }
            if(msgs.size < 100 || (store.after[channelId] && store.after[channelId] != min_snowflake(store.after[channelId], before)))
                break
        }

        store.after[channelId] = channel.lastMessageId;
    };
    save_store();
    console.log("Finished Indexing for ids");
});


collect(async (msg) => {
    try {
        
        if(process_message(await msg.fetch())) save_store();
    } catch (error) {
        console.error(error, msg);
    }
}, { trigger_on_message_update: true });



collect_by_prefix("o?", (message, cont) => {
    let q = cont.trim().toLowerCase();
    let cards = store.users?.[message.author.id];
    if(!cards) {
        message.reply("Found nothing");
        return;
    }

    let matches = Object.entries(cards).map(v => {
        let dis = [v[1].char, ...v[1].char.split(" ")].map(n => ls(n.toLocaleLowerCase(), cont) / n.length).reduce((c, p) => Math.min(c, p), Infinity);
        return {
            dis,
            v
        }
    }).filter(a => a.dis < 0.5).sort((a, b) => a.dis - b.dis).slice(0, 4);

    if(matches.length == 0) {
        message.reply("Found nothing");
        return;
    }

    message.reply({ embeds: [new MessageEmbed({ title: "Id Lookup", description: matches.map(m => `\`${m.v[0]}\` · ${m.v[1].series} · **${m.v[1].char}**`).join("\n") })]});
});