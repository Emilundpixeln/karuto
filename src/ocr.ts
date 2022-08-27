import { collect, collect_by_prefix } from './collector.js';
import { MessageEmbed, TextBasedChannel } from 'discord.js';
import { wl_data } from './shared/klu_data.js';
import { load, recognize } from './shared/ocr.js';


let worker_count = 1;
let loaded = load(worker_count);

collect(async (msg) => {

	if(msg.author.id != "646937666251915264") return;
	if(msg.channelId != "932713994886721576") return;

	let ignore = [
		"282930400710361089"
	];

	
    let to_date = (time: string) => Number(((BigInt(time) >> BigInt(22)) + BigInt(1420070400000)) / BigInt(1000));

	if(msg.content && (msg.content.endsWith("is dropping 3 cards!") || msg.content == "I'm dropping 3 cards since this server is currently active!")) {

		await loaded;

		console.log(msg.content);
		let ref_id = /<@(\d+)>/g.exec(msg.content);
		console.log(`ocr for (${ref_id ? ref_id[1] : "Server Drop"})`);
		if(ref_id && ignore.includes(ref_id[1])) return;

		let expire_text = `Expires <t:${to_date(msg.id) + 60}:R>`;
		let wl_text = "";


		let my_message = msg.reply(expire_text + "\n" + wl_text);
		let update_message = async () => {
			try {
				await (await my_message).edit(expire_text + "\n" + wl_text);
			} catch(_) {}
		}

		setTimeout(async () => {
			expire_text = "Expired";
			update_message();
		}, 60 * 1000);

		let url = [...msg.attachments.values()][0].url;
		
		console.log(`ocr ${url}`);
		let begin = Date.now();
		wl_text = (await recognize(url, false)).map(v => {
			let wl_dat = wl_data?.[v.series]?.[v.char] ?? { wl: 0, date: 0 };
			return `\`♡${wl_dat.wl}\` **${v.char}** ${v.series}${v.rel_err < 0.3 ? "" : "  🚨**Low Confidence**🚨"}${Date.now() - wl_dat.date < 1000 * 60 * 60 * 24 * 7 ? "" : " ⌛ "}||Confidence: ${(100 - 100 * v.rel_err).toFixed(0)}%||`
		}).join("\n") + "\n||Alle Angaben ohne Gewähr||";
		console.log(`OCR took ${Date.now() - begin}ms`);
		update_message();
	}
});


collect_by_prefix("ocr", async (msg_a, cont) => {

	let msg = await msg_a.fetchReference();

	if(!msg) return;

	if(msg.author.id != "646937666251915264") return;
	if(msg.channelId != "932713994886721576") return;

	
    let to_date = (time: string) => Number(((BigInt(time) >> BigInt(22)) + BigInt(1420070400000)) / BigInt(1000));

	if(msg.author.id == "646937666251915264" && msg.content 
	&& (msg.content.endsWith("is dropping 3 cards!")
	|| msg.content == "I'm dropping 3 cards since this server is currently active!"
	|| msg.content.includes("This drop has expired and the cards can no longer be grabbed"))) {

		await loaded;

		console.log(msg.content);
		let ref_id = /<@(\d+)>/g.exec(msg.content);
		console.log(`ocr for (${ref_id ? ref_id[1] : "Server Drop"})`);


		let expire_text = `Expires <t:${to_date(msg.id) + 60}:R>`;
		let wl_text = "";

		let dt = (to_date(msg.id) + 60) * 1000 - Date.now();

		let my_message = msg.reply(expire_text + "\n" + wl_text);
		let update_message = async () => (await my_message).edit(expire_text + "\n" + wl_text);

		if(dt > 0) {
			setTimeout(async () => {
				expire_text = "Expired";
				update_message();
			}, dt);
		} else {
			expire_text = "Expired";
		}

		let url = [...msg.attachments.values()][0].url;
		
		console.log(`ocr ${url}`);
		let begin = Date.now();
		wl_text = (await recognize(url, false)).map(v => {
			let wl_dat = wl_data?.[v.series]?.[v.char] ?? { wl: 0, date: 0 };
			return `\`♡${wl_dat.wl}\` **${v.char}** ${v.series}${v.rel_err < 0.3 ? "" : "  🚨**Low Confidence**🚨"}${Date.now() - wl_dat.date < 1000 * 60 * 60 * 24 * 7 ? "" : " ⌛ "}||Confidence: ${(100 - 100 * v.rel_err).toFixed(0)}%||`
		}).join("\n") + "\n||Alle Angaben ohne Gewähr||";
		console.log(`OCR took ${Date.now() - begin}ms`);
		update_message();
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
        if(!(msg_ref.author.id == "646937666251915264" && msg_ref.content 
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

	if(msg.author.id != "646937666251915264") return;
	if(msg.channelId != "932713994886721576") return;

	if(msg.content && msg.content.endsWith("before dropping more cards.") ) {
		let m = await msg.fetchReference();
		let replys = [
			"Ist doof jetzt oder? 🤡 ",
			"Sei mal etwas geduldiger! ⌛",
			"Kannst du nicht ein wenig warten? 👿",
			"Versuch es mal lieber später 🌕",
			"Hättest du jetzt gedacht 😯",
			"Schlecht gelaufen 🥱",
			"Brauchst nicht traurig sein 😪",
		]
		m.reply(replys[Math.floor(Math.random() * replys.length)]);
		
	}
});

