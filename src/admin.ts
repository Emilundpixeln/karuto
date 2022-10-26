import { collect_by_prefix_and_filter, collect, on_client_available, get_all_messages_untill } from "./collector.js";
import { readFileSync, writeFileSync } from "fs"
import { reload_data } from "./shared/klu_data.js"
import { KARUTA_ID, KARUTA_UPDATE_CHANNEL_ID } from "./constants.js"
import { TextBasedChannel } from "discord.js";


export let is_admin = (user_id: string) => user_id == "261587350121873408";

let add_to_series_file = (to_add: string[]) => {
    let file_name = "../karuta-indexer/data/series_data.json";
    let serieses = JSON.parse(readFileSync(file_name, { encoding: "utf-8"})) as string[];

    let real_added = to_add.filter((ser) => {
        if(serieses.indexOf(ser) != -1) {
            return false;
        }
        serieses.push(ser);
        return true;
    });
    writeFileSync(file_name, JSON.stringify(serieses));
    return real_added;
}

collect_by_prefix_and_filter("oaddseries", (m) => is_admin(m.author.id), (mess, cont) => {
    let to_add = cont.split(";").map(s => s.trim()).filter(s => s.length != 0);
    if(to_add.length == 0) {
        mess.reply("List series ;-seperated");
        return;
    }
    let real_added = add_to_series_file(to_add);
    if(real_added.length == 0)
        mess.reply("Nothing new to add.");
    else
        mess.reply(`Added ${real_added.map(s => `\`${s}\``).join(", ")}.${real_added.length != to_add.length ? " Rest was already added." : ""}`);
})


collect_by_prefix_and_filter("oreload", (m) => is_admin(m.author.id), (mess, cont) => {
    reload_data()
    mess.reply("Reloaded");
});

let parse_series_to_add = (text: string): string[] => {
    let added_series_text = /^\*\*Added \d+ new series\*\*\n```md\n((?:\d+\. .*\n)+)```/g.exec(text);
    if(!added_series_text) return [];

    let inner = added_series_text[1];
    return inner.split("\n").filter(s => s.length != 0).map(s => /\d+\. +(.*)/g.exec(s)[1]);
};

collect((mess) => {
    let text = mess.embeds[0].description;

    let to_add = parse_series_to_add(text);
    let real_added = add_to_series_file(to_add);
    if(real_added.length != 0)
        mess.reply(`Added ${real_added.map(s => `\`${s}\``).join(", ")}.${real_added.length != to_add.length ? " Rest was already added." : ""}`);
}, {
    filter: (mess) => mess.author.id == "996856694611120230" 
        && mess.channelId == KARUTA_UPDATE_CHANNEL_ID
        && mess.embeds.length > 0                      
});

on_client_available(async (client) => {
    let channel = await client.channels.fetch(KARUTA_UPDATE_CHANNEL_ID) as TextBasedChannel;
    get_all_messages_untill(channel, (msg) => {
        if(!(msg.author.id == "996856694611120230" 
            && msg.channelId == KARUTA_UPDATE_CHANNEL_ID
            && msg.embeds.length > 0))
            return false;
        let text = msg.embeds[0].description;
   

        let to_add = parse_series_to_add(text);
        let real_added = add_to_series_file(to_add);

        if(real_added.length == 0)
        {
            return to_add.length != 0;
        }
        else
        {
            msg.reply(`Added ${real_added.map(s => `\`${s}\``).join(", ")}.${real_added.length != to_add.length ? " Rest was already added." : ""}`);
            return false;
        }
    });
});