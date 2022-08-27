import { Discord } from "../../karuta-indexer/src/shared/discord.js"
import { collect, collect_by_prefix, MessageType } from './collector.js';
import { promises, createWriteStream } from 'fs';
import { Message, MessageEmbed } from "discord.js";
import { MESSAGE_CREATE } from "../../karuta-indexer/src/shared/discord_types.js";
import client from 'https';
let store: {
    users: { [id: string]: { [card: string]: number } };
    last_clear: number;
};


let save_store = async () => {
    await promises.writeFile("datecd.json", JSON.stringify(store));
}

let clear_store = () => {
    let oldest = Date.now() - 10 * 60 * 60 * 1000;
    Object.values(store.users).map((cards) => Object.fromEntries(Object.entries(cards).filter(kv => kv[1] >= oldest)));
    store.last_clear = Date.now();
}



promises.readFile("datecd.json", { encoding: "utf-8"}).then((data) => {

    store = JSON.parse(data);
    if(!store.users) store.users = {};
    if(!store.last_clear) store.last_clear = 0;
    let discord_client = new Discord(undefined);


    let process = (description: string, message_id: string) => {
        let lines = description.split("\n");
        let user = /<@(\d+)>/g.exec(lines[0])[1];
        let card = lines[1].split("·")[1].trim();

       
        if(!store.users[user]) store.users[user] = {};
        if(Date.now() - store.users[user][card] < 1000 * 60 * 60 * 4)
            return;
        console.log("Datecd:", user, card);

        store.users[user][card] = Date.now();

        if(Date.now() - store.last_clear > 1000 * 60 * 60)
            clear_store();

        save_store();
    };
    let b = Date.now();
    discord_client.on_MESSAGE_CREATE((message) => {
        if(message.guild_id == "715844052700102757") console.log("KIT", (Date.now() - b) / 1000);
        if(message.author.id == "646937666251915264" && message.embeds.length > 0
        && message.embeds[0].title == "Date Minigame")  process(message.embeds[0].description, message.id);

  
    });

    discord_client.on_MESSAGE_UPDATE((message) => {
    // console.log(message);
        // TODO confirm author are correct
        if(/*message.author.id == "646937666251915264" && */message.embeds.length > 0
        && message.embeds[0].title == "Date Minigame")  process(message.embeds[0].description, message.id);

    }); 
    
    discord_client.on_ready().then(_ => {
        discord_client.subscribe("696070301842276353");
        discord_client.subscribe("715844052700102757");
    });


    collect((message) => {
        if(!(message.author.id == "646937666251915264" && message.embeds.length > 0
        && message.embeds[0].title == "Date Minigame" )) return;

        process(message.embeds[0].description, message.id);


    }, { trigger_on_message_update: true });
});



collect_by_prefix("odatecd", (message, cont) => {
    let id = cont.trim().length != 0 ? cont.trim() : message.author.id;

    if(!store.users[id]) {
        message.reply("No Characters on Cooldown");
        return;
    }
    let oldest = Date.now() - 10 * 60 * 60 * 1000;

    let text = Object.entries(store.users[id]).filter(kv => kv[1] >= oldest).sort((a, b) => a[1] - b[1]).map(kv => `${kv[0]} <t:${(kv[1] / 1000 + 10 * 60 * 60).toFixed(0)}:R>`);


    if(text.length == 0) {
        message.reply("No Characters on Cooldown");
    } else {
        message.reply({ embeds: [ new MessageEmbed().setTitle("Date Cooldown").setDescription(text.join("\n")).setColor("FUCHSIA")]})
    }

});

