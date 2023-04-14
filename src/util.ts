import { Client, Guild, TextBasedChannel } from "discord.js";
import { ActivityTypes } from "discord.js/typings/enums";
import { api_available } from "./client.js";
import { collect_by_prefix, SlashCommand, register_command, on_client_available } from "./collector.js";
import { MessageHandler } from "./message_handler.js";
import { series_strs, wl_data, wl_data_too_new } from "./shared/klu_data.js";

export let send_offset_ms = 0;


collect_by_prefix("ocache", async (m) => {
    const a = await m.channel.messages.fetch();
    console.log(a.lastKey());
});

const set_ping_data = (client: Client, send: number, receive: number) => {
    send_offset_ms = send;
    const api_ping = client.ws.ping;
    const api_availability = api_available() ? "🪐" : "";
    client.user?.setActivity({
        name: `${api_availability}🔄${send + receive}ms⬇️${receive}ms⬆️${send}ms🔌${api_ping}ms`,
        type: ActivityTypes.LISTENING
    });
};

const do_ping = async (m: MessageHandler, created_timestamp: number) => {
    const begin = Date.now();
    const mymsg = await m.send("Pinging...");
    send_offset_ms = mymsg.createdTimestamp - begin;
    set_ping_data(mymsg.client, mymsg.createdTimestamp - begin, begin - created_timestamp);
    m.send(`Roundtrip: \`${mymsg.createdTimestamp - created_timestamp}ms\` \tReceive: \`${begin - created_timestamp}ms\` \tSend: \`${send_offset_ms}ms\` \t`
        + `Api: \`${mymsg.client.ws.ping}ms\``);

};

on_client_available(async (client) => {
    const channel = await client.channels.fetch("1021945490742444053") as TextBasedChannel;
    const calc_offsets = async () => {
        const begin = Date.now();
        const my_msg = await channel.send("Ping Test");

        set_ping_data(client, my_msg.createdTimestamp - begin, Date.now() - my_msg.createdTimestamp);
        console.log(`Ping Test: Receive: ${Date.now() - my_msg.createdTimestamp}ms Send: ${send_offset_ms}ms`);
        my_msg.delete();
    };
    calc_offsets();
    setInterval(calc_offsets, 10 * 60 * 1000).unref();
});

register_command(new SlashCommand().setDescription("Get Ping Information").setName("ping"), (i) => {
    do_ping(MessageHandler.as_interaction_command_reply(i), i.createdTimestamp);

});
collect_by_prefix("oping", async (m) => {
    do_ping(MessageHandler.as_message_reply(m), m.createdTimestamp);
});


const order = "mv0qh2wk5bjn1z4pr3g9fl8t7dsx6c";

const encode_card_id = (s: string) => {
    if(s.length == 0) {
        return -1;
    }
    let id = 0;
    for(let i = 0; i < s.length; i++) {

        const off = order.indexOf(s[i]);
        if(off == -1)
            continue;
        id *= order.length;
        id += off;
    }
    return id;
};

const card_str_from_id = (id: number) => {
    const length = id == 0 ? 1 : Math.floor(Math.log(id) / Math.log(30) + 1);
    const s = new Array<number>(length);
    for(let i = length - 1; i >= 0; i--) {
        s[i] = order.charCodeAt(id % 30);
        id /= 30;
    }
    return s.reduce((v, c) => v + String.fromCharCode(c), "");
};


const do_get_num_id = (m: MessageHandler, id: string) => {
    const num = encode_card_id(id);
    m.send(num != -1 ? `Card \`${id}\` has id \`${num}\`.` : "Not a valid card id!");
};

const do_from_num_id = (m: MessageHandler, id: string | number) => {
    m.send(!isNaN(Number(id)) ? `Card with numeric id \`${id}\` has id \`${card_str_from_id(Number(id))}\`.` : "Not a valid card id!");
};

register_command(new SlashCommand().setDescription("Convert a card id like `xth0sj` to a number").setName("get_numeric_id")
    .addStringOption(e => e.setDescription("The Id").setName("id").setMinLength(1).setMaxLength(10).setRequired(true)), (i) => {
        const id = i.options.getString("id", true);
        do_get_num_id(MessageHandler.as_interaction_command_reply(i), id);
    });
collect_by_prefix("ogetid", async (m, cont) => {
    do_get_num_id(MessageHandler.as_message_reply(m), cont);
});


register_command(new SlashCommand().setDescription("Convert a numeric id to a card id like `xth0sj`").setName("from_numeric_id")
    .addIntegerOption(e => e.setDescription("The numeric id").setName("id").setMinValue(1).setRequired(true)), (i) => {
        const id = i.options.getInteger("id", true);
        do_from_num_id(MessageHandler.as_interaction_command_reply(i), id);
    });
collect_by_prefix("ofromid", async (m, cont) => {
    do_from_num_id(MessageHandler.as_message_reply(m), cont);
});

const do_query = (m: MessageHandler, query: string) => {
    const lowercase = query.toLowerCase();
    const serieses = series_strs.filter(s => s.toLowerCase().includes(lowercase));
    // [series, character, wl_data]
    const chars = Object.entries(wl_data).map(s => Object.entries(s[1]).filter(c => c[0].toLowerCase().includes(lowercase)).map(c => [s[0], ...c] as const)).flat();
    const text = serieses.map(v => `Series: **${v}**\n`).join("") + chars.map(v => `**${v[0]}** ${v[1]} \`♡${v[2].wl == wl_data_too_new ? "NEW" : v[2].wl}\``).join("\n");
    m.send(text.length > 3000 ? text.slice(0, 2997) + "..." : text);
};

register_command(new SlashCommand().setDescription("Query series- and characterdata").setName("query")
    .addStringOption(i => i.setDescription("Series or character name").setName("query").setRequired(true)), i => {
        do_query(MessageHandler.as_interaction_command_reply(i), i.options.getString("query", true));
    });

collect_by_prefix("oquery", (m, cont) => {
    const query = cont.trim();
    if(!query) return m.reply("Provide a series or character name to search for.");
    do_query(MessageHandler.as_message_reply(m), query);
});

register_command(new SlashCommand().setDescription("Export wishlist data").setName("export_wl_data"), i => {
    i.reply({
        files: [{
            attachment: "wl_data.json",
            name: "wl_data.json"
        }]
    });
});

const do_list_activities = async (m: MessageHandler, guild: Guild | null, member_id: string) => {
    if(!guild) return m.send("Can't be used outside of a server!");

    const member = await guild.members.fetch(member_id);
    if(!member) return m.send("Can't fetch member!");
    m.send("```" + JSON.stringify(member.presence?.activities, (_, value) => value ? value : undefined, 2) + "```");
};

register_command(new SlashCommand().setDescription("See all activities of a user").setName("list_activities").setDMPermission(false)
    .addUserOption(o => o.setDescription("The user").setName("user").setRequired(false)), async i => {
        const id = i.options.getUser("user", false)?.id ?? i.user.id;
        do_list_activities(MessageHandler.as_interaction_command_reply(i), i.guild, id);
    });


collect_by_prefix("olistact", async (m, cont) => {
    let id = cont.trim();
    if(!id) id = m.author.id;

    do_list_activities(MessageHandler.as_message_reply(m), m.guild, id);
});
