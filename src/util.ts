import { Client, TextBasedChannel } from "discord.js";
import { ActivityTypes } from "discord.js/typings/enums";
import { collect_by_prefix, SlashCommand, register_command, MessageType, snowflake_to_timestamp, on_client_available } from "./collector.js"
import { MessageHandler } from "./message_handler.js"

export let send_offset_ms = 0;


collect_by_prefix("ocache", async (m, cont) => {
    let a = await m.channel.messages.fetch();
    console.log(a.lastKey());
});

let set_ping_data = (client: Client, send: number, receive: number) => {
    send_offset_ms = send;
    let api = client.ws.ping;
    client.user.setActivity({
        name: `🔄${send + receive}ms⬇️${receive}ms⬆️${send}ms🔌${api}ms`,
        type: ActivityTypes.LISTENING
    })
}

let do_ping = async (m: MessageHandler, reply_to: MessageType, created_timestamp: number) => {
    let begin = Date.now();
    let mymsg = await m.reply(reply_to, "Pinging...");
    send_offset_ms = mymsg.createdTimestamp - begin;
    set_ping_data((await m.message).client, mymsg.createdTimestamp - begin, begin - created_timestamp);
    m.edit(`Roundtrip: \`${mymsg.createdTimestamp - created_timestamp}ms\` \tReceive: \`${begin - created_timestamp}ms\` \tSend: \`${send_offset_ms}ms\` \t`
        + `Api: \`${(await m.message).client.ws.ping}ms\``);

}

on_client_available(async (client) => {
    let channel = await client.channels.fetch("1021945490742444053") as TextBasedChannel;
    let calc_offsets = async () => {
        let begin = Date.now();
        let my_msg = await channel.send("Ping Test");

        set_ping_data(client, my_msg.createdTimestamp - begin, Date.now() - my_msg.createdTimestamp);
        console.log(`Ping Test: Receive: ${Date.now() - my_msg.createdTimestamp}ms Send: ${send_offset_ms}ms`);
        my_msg.delete();
    };
    calc_offsets();
    setInterval(calc_offsets, 10 * 60 * 1000).unref();
})

register_command(new SlashCommand().setDescription("Get Ping Information").setName("ping"), (i) => {
    do_ping(new MessageHandler(i), undefined, i.createdTimestamp);
    
});
collect_by_prefix("oping", async (m, cont) => {
    do_ping(new MessageHandler(), m, m.createdTimestamp);
});


const order = "mv0qh2wk5bjn1z4pr3g9fl8t7dsx6c";

let encode_card_id = (s: string) => {
	if (s.length == 0)
	{
		return -1;
	}
	let id = 0;
	for (let i = 0; i < s.length; i++) {
		
        let off = order.indexOf(s[i]);
		if (off == -1)
			continue;
        id *= order.length;
		id += off;
	}
	return id;
}

let card_str_from_id = (id: number) => {
	let length = id == 0 ? 1 : Math.floor(Math.log(id) / Math.log(30) + 1);
	let s = new Array<number>(length);
	for (let i = length - 1; i >= 0; i--) {
		s[i] = order.charCodeAt(id % 30);
		id /= 30;
	}
	return s.reduce((v, c) => v + String.fromCharCode(c), "");
}


let do_get_num_id = (m: MessageHandler, reply_to: MessageType, id: string) => {
    let num = encode_card_id(id);
    m.reply(reply_to, num != -1 ? `Card \`${id}\` has id \`${num}\`.` : "Not a valid card id!");
}

let do_from_num_id = (m: MessageHandler, reply_to: MessageType, id: string | number) => {
    m.reply(reply_to, !isNaN(Number(id)) ? `Card with numeric id \`${id}\` has id \`${card_str_from_id(Number(id))}\`.` : "Not a valid card id!");
}

register_command(new SlashCommand().setDescription("Convert a card id like `xth0sj` to a number").setName("get_numeric_id")
    .addStringOption(e => e.setDescription("The Id").setName("id").setMinLength(1).setMaxLength(10).setRequired(true)), (i) => {
    let id = i.options.getString("id");
    do_get_num_id(new MessageHandler(i), undefined, id);
});
collect_by_prefix("ogetid", async (m, cont) => {
    do_get_num_id(new MessageHandler(), m, cont);
});


register_command(new SlashCommand().setDescription("Convert a numeric id to a card id like `xth0sj`").setName("from_numeric_id")
    .addIntegerOption(e => e.setDescription("The numeric id").setName("id").setMinValue(1).setRequired(true)), (i) => {
    let id = i.options.getInteger("id");
    do_from_num_id(new MessageHandler(i), undefined, id);
});
collect_by_prefix("ofromid", async (m, cont) => {
    do_from_num_id(new MessageHandler(), m, cont);
});

