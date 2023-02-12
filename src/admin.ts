import { collect_by_prefix_and_filter, collect, on_client_available, get_all_messages_untill } from "./collector.js";
import { readFileSync, writeFileSync } from "fs";
import { reload_data, wl_data, wl_data_path, wl_data_too_new } from "./shared/klu_data.js";
import { KARUTA_ID, KARUTA_UPDATE_CHANNEL_ID } from "./constants.js";
import { TextBasedChannel } from "discord.js";
import { reload } from "./shared/ocr.js";


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


let add_to_chars_file = (to_add: { series: string, char: string }[]) => {
    let file_name = "../karuta-indexer/data/wl_data.json";


    let real_added = to_add.filter(({ series, char }) => {
        if(!wl_data[series]) {
            wl_data[series] = {}
        }
        if(wl_data[series][char]) return false; 
        wl_data[series][char] = {
            date: Date.now(),
            wl: wl_data_too_new
        }
        return true;
    });

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
    reload_data();
    reload();
    mess.reply("Reloaded");
});

let parse_series_to_add = (text: string): string[] => {
    let added_series_text = /^\*\*Added \d+ new series\*\*\n```md\n((?:\d+\. .*\n)+)```/g.exec(text);
    if(!added_series_text) return [];

    let inner = added_series_text[1];
    return inner.split("\n").filter(s => s.length != 0).map(s => /\d+\. +(.*)/g.exec(s)[1]);
};

let parse_chars_to_add = (text: string): { series: string, char: string }[] => {
    return text.split("\n").map(s => {    
        let series_closing_paranthesis = s.lastIndexOf(")");
        if(series_closing_paranthesis < 0) return undefined;
        let i = series_closing_paranthesis - 1;
        let closing_paranthesis = 1;
        let series_opening_paranthesis = -1;
        while(i >= 0) {
            if(s[i] == ")") closing_paranthesis++;
            if(s[i] == "(") closing_paranthesis--;
            if(closing_paranthesis == 0 && series_opening_paranthesis == -1) series_opening_paranthesis = i;
            i -= 1;
        }
        if(closing_paranthesis != 0) {
            console.error(`parse_chars_to_add: Unbalanced brackets: "${s}"`);
            return undefined;
        }
        let series = s.substr(series_opening_paranthesis + 1, series_closing_paranthesis - (series_opening_paranthesis + 1))

        let match = /^\d+. (.*) $/g.exec(s.substr(0, series_opening_paranthesis));
        if(!match) return undefined;
        return {
            series,
            char: match[1]
        };
    }).filter(s => s);
};


collect((mess) => {
    let text = mess.embeds[0].description;

    let to_add = parse_series_to_add(text);
    let real_added = add_to_series_file(to_add);


    let chars_to_add = parse_chars_to_add(text);
    let added_chars = 0;
    if(chars_to_add.length > 0)
    {
        reload_data();
        added_chars += add_to_chars_file(chars_to_add).length;
        writeFileSync(wl_data_path, JSON.stringify(wl_data));
    }
    let resp = ""
    if(real_added.length != 0)
        resp += `Added ${real_added.map(s => `\`${s}\``).join(", ")}.${real_added.length != to_add.length ? " Rest was already added." : ""}`;
    if(added_chars != 0)
        resp += `\nAdded ${added_chars} character${added_chars == 1 ? "" : "s"}` 
    if(resp.length > 0)
        mess.reply(resp);

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
        
        let chars_to_add = parse_chars_to_add(text);
        let added_chars = 0;
        if(chars_to_add.length > 0)
        {
            reload_data();
            let added = add_to_chars_file(chars_to_add);
            console.log("Added characters:", added);
            added_chars += added.length;
            writeFileSync(wl_data_path, JSON.stringify(wl_data));
        }

        if(real_added.length == 0 && added_chars == 0)
        {
            // just stop on already added series
            return to_add.length != 0; //!(to_add.length == 0 && chars_to_add.length == 0);
        }
        else
        {
            let resp = ""
            if(real_added.length != 0)
                resp += `Added ${real_added.map(s => `\`${s}\``).join(", ")}.${real_added.length != to_add.length ? " Rest was already added." : ""}`;
            if(added_chars != 0)
                resp += `\nAdded ${added_chars} character${added_chars == 1 ? "" : "s"}` 
            
            if(resp.length > 0)
                msg.reply(resp);
            return false;
        }
    });
});