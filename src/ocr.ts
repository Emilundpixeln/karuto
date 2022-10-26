import { collect, collect_by_prefix, collect_by_prefix_and_filter, MessageType } from './collector.js';
import { MessageEmbed, TextBasedChannel } from 'discord.js';
import { wl_data } from './shared/klu_data.js';
import { load, recognize } from './shared/ocr.js';
import { is_admin } from "./admin.js"
import { KARUTA_ID } from "./constants.js"

let worker_count = 1;
let worker_count_fast = 4;
let loaded = load(worker_count);

let do_update = true;


collect_by_prefix_and_filter("ocrtoggle", (m) => is_admin(m.author.id), async (m, cont) => {
	do_update = !do_update;
	let text = do_update ? "Normal dropmode" : "Fast dropmode";
	let my_msg = m.reply(`Loading ${text}...`);
	loaded = load(do_update ? worker_count : worker_count_fast).then(async _ => {
		(await my_msg).edit(`Loaded ${text}`);
	});
})


let do_ocr = async (url: string, msg_id: string | undefined, img_width: number | undefined, reply_to: MessageType) => {

	await loaded;


    let to_date = (time: string) => Number(((BigInt(time) >> BigInt(22)) + BigInt(1420070400000)) / BigInt(1000));
	let expire_text = msg_id ? `Expires <t:${to_date(msg_id) + 60}:R>` : "?";
	let wl_text = img_width != undefined ? "\u2800\n\u2800\n\u2800\n\u2800" + (img_width> 900 ? "\n\u2800" : "") : "";


	let my_message = do_update ? reply_to.reply(expire_text + "\n" + wl_text) : undefined;
	let update_message = async () => {
		try {
			if(!my_message) 
				my_message = reply_to.reply(expire_text + "\n" + wl_text);
			else 
				await (await my_message).edit(expire_text + "\n" + wl_text);
		} catch(_) {}
	}


	if(msg_id && (to_date(msg_id) + 60) * 1000 - Date.now() > 0) {
		if(do_update)
		{
			setTimeout(async () => {
				expire_text = "Expired";
				update_message();
			}, 60 * 1000);
			
		}

	} else if(msg_id) {
		expire_text = "Expired";
	}


	
	console.log(`ocr ${url}`);
	let begin = Date.now();
	let highest_wl = 0;
	wl_text = (await recognize(url, false)).map(v => {
		let wl_dat = wl_data?.[v.series]?.[v.char] ?? { wl: 0, date: 0 };
		if(v.rel_err >= 0.3) 
		{
			// Log
			console.warn(`OCR: Low confidence for ${url}`);
			console.warn(v);
		}
		highest_wl = Math.max(highest_wl, wl_dat.wl);
		return `\`♡${wl_dat.wl}\` **${v.char}** ${v.series}${v.rel_err < 0.3 ? "" : "  🚨**Low Confidence**🚨"}${Date.now() - wl_dat.date < 1000 * 60 * 60 * 24 * 7 ? "" : " ⌛ "}||Confidence: ${(100 - 100 * v.rel_err).toFixed(0)}%||`
	}).join("\n") + "\n||Alle Angaben ohne Gewähr||";
	console.log(`OCR took ${Date.now() - begin}ms`);
	if(do_update || highest_wl > 200)
		update_message();

}
collect(async (msg) => {

	if(msg.author.id != KARUTA_ID) return;
	if(msg.channelId != "932713994886721576") return;

	let ignore = [
		"282930400710361089"
	];

	
	

	if(msg.content && (msg.content.endsWith("is dropping 3 cards!") || msg.content == "I'm dropping 3 cards since this server is currently active!"
						|| msg.content.endsWith("is dropping 4 cards!") || msg.content == "I'm dropping 4 cards since this server is currently active!")) {

		await loaded;

		let img = [...msg.attachments.values()][0];
		do_ocr(img.url, msg.id, img.width, msg);
	}
});


collect_by_prefix("ocr", async (msg_a, cont) => {


	if(msg_a.reference) 
	{
		let msg = await msg_a.fetchReference();

		if(!msg) return;
	
		if(msg.author.id != KARUTA_ID) return;
		if(msg.channelId != "932713994886721576") return;
	
		
	
	
		if(msg.author.id == KARUTA_ID && msg.content 
		&& (msg.content.endsWith("is dropping 3 cards!")
		|| msg.content == "I'm dropping 3 cards since this server is currently active!"
		|| msg.content.endsWith("is dropping 4 cards!")
		|| msg.content == "I'm dropping 4 cards since this server is currently active!"
		|| msg.content.includes("This drop has expired and the cards can no longer be grabbed"))) {
			let img = [...msg.attachments.values()][0];

			do_ocr(img.url, msg.id, img.width, msg);
		}
	}
	else {

		do_ocr(cont.trim(), undefined, undefined, msg_a);
	}


});


collect_by_prefix("odocr", async (msg, rest) => {

    await loaded;
	if(msg.author.id != "261587350121873408") return;

    let link = /discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/g.exec(rest);

    if(link) {
        
        let channel = msg.client.channels.cache.get(link[2]);

        if(!channel.isText()) return msg.reply("Failed loading link!");
        let msg_ref = await (channel as TextBasedChannel).messages.fetch(link[3]);
        if(!(msg_ref.author.id == KARUTA_ID && msg_ref.content 
            && (msg_ref.content.endsWith("is dropping 3 cards!")
			|| msg_ref.content == "I'm dropping 3 cards since this server is currently active!"
			|| msg_ref.content.includes("This drop has expired and the cards can no longer be grabbed")))) return msg.reply("Not a drop!");;

        msg.reply({ embeds: [ new MessageEmbed().setDescription(`\`\`\`\n${JSON.stringify(await recognize([...msg_ref.attachments.values()][0].url, true), null, 2)}\n\`\`\``) ] });
    } else {
        msg.reply("Provide a message link");
    }
});


//loaded.then(async () => console.log(await recognize("https://cdn.discordapp.com/attachments/932713994886721576/1008032097388204142/card.webp", true))) 
//loaded.then(async () => console.log(await recognize("https://cdn.discordapp.com/attachments/648044573536550922/958036013131902987/card.webp", true)))
//loaded.then(async () => console.log(await recognize("https://cdn.discordapp.com/attachments/932713994886721576/1007997775717351505/card.webp", true))) 

collect(async (msg) => {

	if(msg.author.id != KARUTA_ID) return;
	if(msg.channelId != "932713994886721576") return;

	if(msg.content && msg.content.endsWith("before dropping more cards.") ) {
		let m = msg.reference ? await msg.fetchReference() : undefined;
		let replys = [
			"Ist doof jetzt oder? 🤡 ",
			"Sei mal etwas geduldiger! ⌛",
			"Kannst du nicht ein wenig warten? 👿",
			"Versuch es mal lieber später 🌕",
			"Hättest du jetzt gedacht 😯",
			"Schlecht gelaufen 🥱",
			"Brauchst nicht traurig sein 😪",
		];
		let text = replys[Math.floor(Math.random() * replys.length)];
		if(m.author.id == "272002648641634304" && Math.random() < 0.4)
			text = replys[0];
		m ? m.reply(text) : msg.channel.send(`<@${/<@(\d+)>/.exec(msg.content)[1]}> ${text}`);
		
	}
});

