import { collect, collect_by_prefix } from "./collector.js";
import { promises } from "fs";
import { MessageEmbed } from "discord.js";
import { KARUTA_ID } from "./constants.js";


let store: {
    users: { [id: string]: { [card: string]: number } };
    last_clear: number;
};


const save_store = async () => {
    await promises.writeFile("datecd.json", JSON.stringify(store));
};

const clear_store = () => {
    const oldest = Date.now() - 10 * 60 * 60 * 1000;
    Object.values(store.users).map((cards) => Object.fromEntries(Object.entries(cards).filter(kv => kv[1] >= oldest)));
    store.last_clear = Date.now();
};



promises.readFile("datecd.json", { encoding: "utf-8" }).then((data) => {

    store = JSON.parse(data);
    if(!store.users) store.users = {};
    if(!store.last_clear) store.last_clear = 0;


    const process = (description: string) => {
        const lines = description.split("\n");
        const user = /<@(\d+)>/g.exec(lines[0])?.[1];
        if(!user) return;
        const card = lines[1].split("·")[1].trim();


        if(!store.users[user]) store.users[user] = {};
        if(Date.now() - store.users[user][card] < 1000 * 60 * 60 * 4)
            return;
        console.log("Datecd:", user, card);

        store.users[user][card] = Date.now();

        if(Date.now() - store.last_clear > 1000 * 60 * 60)
            clear_store();

        save_store();
    };

    collect((message) => {
        if(!(message.author.id == KARUTA_ID && message.embeds.length > 0
            && message.embeds[0].title == "Date Minigame" && message.embeds[0].description)) return;

        process(message.embeds[0].description);


    }, { trigger_on_message_update: true });
});



collect_by_prefix("odatecd", (message, cont) => {
    const id = cont.trim().length != 0 ? cont.trim() : message.author.id;

    if(!store.users[id]) {
        message.reply("No Characters on Cooldown");
        return;
    }
    const oldest = Date.now() - 10 * 60 * 60 * 1000;

    const text = Object.entries(store.users[id]).filter(kv => kv[1] >= oldest).sort((a, b) => a[1] - b[1]).map(kv => `${kv[0]} <t:${(kv[1] / 1000 + 10 * 60 * 60).toFixed(0)}:R>`);


    if(text.length == 0) {
        message.reply("No Characters on Cooldown");
    } else {
        message.reply({ embeds: [new MessageEmbed().setTitle("Date Cooldown").setDescription(text.join("\n")).setColor("FUCHSIA")] });
    }

});

