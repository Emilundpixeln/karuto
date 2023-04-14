import { collect_by_prefix_and_filter, collect, on_client_available, get_all_messages_untill } from "./collector.js";
import { reload_data } from "./shared/klu_data.js";
import { KARUTA_UPDATE_CHANNEL_ID } from "./constants.js";
import { TextBasedChannel } from "discord.js";
import { reload } from "./shared/ocr.js";
import { api, api_unavailable_error_message, on_api_connect } from "./client.js";


export const is_admin = (user_id: string) => user_id == "261587350121873408";

collect_by_prefix_and_filter("oaddseries", (m) => is_admin(m.author.id), async (mess, cont) => {
    const to_add = cont.split(";").map(s => s.trim()).filter(s => s.length != 0);
    if(to_add.length == 0) {
        mess.reply("List series ;-seperated");
        return;
    }
    const real_added = await api.admin.add_to_series_file.mutate({ to_add }).catch(_ => null);
    if(real_added == null)
        mess.reply(api_unavailable_error_message);
    else if(real_added.length == 0)
        mess.reply("Nothing new to add.");
    else
        mess.reply(`Added ${real_added.map(s => `\`${s}\``).join(", ")}.${real_added.length != to_add.length ? " Rest was already added." : ""}`);
});


collect_by_prefix_and_filter("oreload", (m) => is_admin(m.author.id), (mess, _cont) => {
    reload_data();
    reload();
    mess.reply("Reloaded");
});

const parse_series_to_add = (text: string): string[] => {
    const added_series_text = /^\*\*Added \d+ new series\*\*\n```md\n((?:\d+\. .*\n)+)```/g.exec(text);
    if(!added_series_text) return [];

    const inner = added_series_text[1];
    return inner.split("\n").filter(s => s.length != 0).map(s => /\d+\. +(.*)/g.exec(s)?.[1]).filter(Boolean);
};

const parse_chars_to_add = (text: string): { series: string, char: string }[] => {
    return text.split("\n").map(s => {
        const series_closing_paranthesis = s.lastIndexOf(")");
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
        const series = s.substring(series_opening_paranthesis + 1, series_closing_paranthesis);

        const match = /^\d+. (.*) $/g.exec(s.substring(0, series_opening_paranthesis));
        if(!match) return undefined;
        return {
            series,
            char: match[1]
        };
    }).filter(Boolean);
};

const process_message = async (text: string) => {
    const to_add = text ? parse_series_to_add(text) : [];
    const real_added = to_add.length > 0 ? await api.admin.add_to_series_file.mutate({ to_add }).catch(_ => null) : [];
    if(real_added == null) return null;

    const chars_to_add = text ? parse_chars_to_add(text) : [];
    const added_chars = chars_to_add.length > 0 ? await api.admin.add_to_chars_file.mutate({ to_add: chars_to_add }).catch(_ => null) : [];
    if(added_chars == null) return null;

    return {
        to_add_series_length: to_add.length,
        added_series: real_added,
        added_chars_length: added_chars.length
    };
};

collect(async (mess) => {
    const text = mess.embeds[0].description;
    if(!text) return;

    const res = await process_message(text);
    if(res == null) return;

    let resp = "";
    if(res.added_series.length != 0)
        resp += `Added ${res.added_series.map(s => `\`${s}\``).join(", ")}.${res.added_series.length != res.to_add_series_length ? " Rest was already added." : ""}`;
    if(res.added_chars_length != 0)
        resp += `\nAdded ${res.added_chars_length} character${res.added_chars_length == 1 ? "" : "s"}`;
    if(resp.length > 0)
        mess.reply(resp);

}, {
    filter: (mess) => mess.author.id == "996856694611120230"
        && mess.channelId == KARUTA_UPDATE_CHANNEL_ID
        && mess.embeds.length > 0
});

on_client_available(async (client) => {

    on_api_connect(async _ => {
        const channel = await client.channels.fetch(KARUTA_UPDATE_CHANNEL_ID) as TextBasedChannel;
        let i = 0;
        get_all_messages_untill(channel, async msg => {
            if(!(msg.author.id == "996856694611120230"
                && msg.channelId == KARUTA_UPDATE_CHANNEL_ID
                && msg.embeds.length > 0))
                return false;
            const text = msg.embeds[0].description;
            if(text == null) return true;

            const res = await process_message(text);
            if(res == null) return true;

            const { added_series, added_chars_length, to_add_series_length } = res;

            if(added_series.length == 0 && added_chars_length == 0) {
                // just stop on already added series
                return to_add_series_length != 0 && i++ > 10; //!(to_add.length == 0 && chars_to_add.length == 0);
            }
            else {
                let resp = "";
                if(added_series.length != 0)
                    resp += `Added ${added_series.map(s => `\`${s}\``).join(", ")}.${added_series.length != to_add_series_length ? " Rest was already added." : ""}`;
                if(added_chars_length != 0)
                    resp += `\nAdded ${added_chars_length} character${added_chars_length == 1 ? "" : "s"}`;

                if(resp.length > 0)
                    msg.reply(resp);
                return false;
            }
        });
    });
});