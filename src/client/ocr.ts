import { collect, collect_by_prefix, collect_by_prefix_and_filter, MessageType } from "./collector.js";
import { MessageEmbed, TextBasedChannel } from "discord.js";
import { recognize } from "../shared/ocr.js";
import { is_admin } from "./admin.js";
import { KARUTA_ID } from "./constants.js";
import { send_offset_ms } from "./util.js";
import { MessageAttachment } from "discord.js";



let do_update = true;


collect_by_prefix_and_filter("ocrtoggle", (m) => is_admin(m.author.id), async () => {
    do_update = !do_update;
    //	let my_msg = m.reply(`Loading ${text}...`);

});


const do_ocr = async (image: string | MessageAttachment, created_timestamp: number, img_width: number | null, reply_to: MessageType) => {

    // proxy url is 4x faster?
    const url = typeof image == "string" ? image : image.proxyURL;


    console.log(`OCR start: ${Date.now() - created_timestamp}`);

    const recognize_result_p = recognize(url, false);

    let expire_text = created_timestamp ? `Expires <t:${Math.floor(created_timestamp / 1000) + 60}:R>` : "?";
    let wl_text = img_width != null ? "\u2800\n\u2800\n\u2800\n\u2800" + (img_width > 900 ? "\n\u2800" : "") : "";

    const do_initial_message = false;
    let my_message = do_update && do_initial_message ? reply_to.reply(expire_text + "\n" + wl_text) : undefined;
    const update_message = async () => {
        try {
            if(!my_message)
                my_message = reply_to.reply(expire_text + "\n" + wl_text);
            else
                await (await my_message).edit(expire_text + "\n" + wl_text);
        } catch(_) {
            // message has been deleted
        }
    };

    let expired_timout = undefined as NodeJS.Timeout | undefined;
    if(created_timestamp && created_timestamp + 60 * 1000 - Date.now() > 0) {
        if(do_update) {
            expired_timout = setTimeout(async () => {
                expire_text = "Expired";
                update_message();
            }, 60 * 1000);

        }

    } else if(created_timestamp) {
        expire_text = "Expired";
    }



    console.log(`ocr ${url}`);
    const begin = Date.now();
    let highest_wl = 0;
    const recognize_result = await recognize_result_p;
    console.log(recognize_result);
    if(recognize_result == undefined) {
        if(expired_timout) clearTimeout(expired_timout);
        return;
    }

    wl_text = recognize_result != undefined ?
        recognize_result.map(v => {
            if(v.confidence < 0.7) {
                // Log
                console.warn(`OCR: Low confidence for ${url}`);
                console.warn(v);
            }
            highest_wl = Math.max(highest_wl, v.wl);
            const wl_text = v.wl != -1 ? v.wl : "[NEW]";
            const confidence_text = v.confidence >= 0.7 ? "" : "  🚨**Low Confidence**🚨";
            const out_of_date_text = Date.now() - v.date < 1000 * 60 * 60 * 24 * 7 ? "" : " ⌛ ";

            return `\`♡${wl_text}\` **${v.char}** ${v.series}${confidence_text}${out_of_date_text} ||Confidence: ${(100 * v.confidence).toFixed(0)}%||`;
        }).join("\n") + `\n||Alle Angaben ohne Gewähr ${Date.now() - begin}ms||`
        : "Error";

    const time = created_timestamp ? Date.now() - created_timestamp + send_offset_ms : 0;
    console.log(`OCR took ${Date.now() - begin}ms. Finished ${created_timestamp ? time : "?"}ms after creation`);
    if(do_update || highest_wl > 200) {
        if(time < 1500 || time > 4000)
            update_message();
        else {
            // Buttons enable in < 500ms, delay message to not disturb grabbing
            // 2 seconds after grabbing is enabled
            setTimeout(() => update_message(), 4000 - time);
            console.log("Delaying message...");
        }
    }

};
collect(async (msg) => {

    if(msg.author.id != KARUTA_ID) return;
    if(msg.channelId != "932713994886721576") return;

    if(msg.content && (msg.content.endsWith("is dropping 3 cards!") || msg.content == "I'm dropping 3 cards since this server is currently active!"
        || msg.content.endsWith("is dropping 4 cards!") || msg.content == "I'm dropping 4 cards since this server is currently active!")) {

        const img = [...msg.attachments.values()][0];
        do_ocr(img, msg.createdTimestamp, img.width, msg);
    }
});


collect_by_prefix("ocr", async (msg_a, cont) => {
    if(!msg_a.reference) return do_ocr(cont.trim(), msg_a.createdTimestamp, null, msg_a);

    const msg = await msg_a.fetchReference();

    if(!msg) return;

    if((is_admin(msg.author.id) && [...msg.attachments.values()].length > 0)
        || msg.author.id == KARUTA_ID && msg.content
        && (msg.content.endsWith("is dropping 3 cards!")
            || msg.content == "I'm dropping 3 cards since this server is currently active!"
            || msg.content.endsWith("is dropping 4 cards!")
            || msg.content == "I'm dropping 4 cards since this server is currently active!"
            || msg.content.includes("This drop has expired and the cards can no longer be grabbed"))) {
        const img = [...msg.attachments.values()][0];

        do_ocr(img, msg.createdTimestamp, img.width, msg);
    }
});


collect_by_prefix("odocr", async (msg, rest) => {
    if(msg.author.id != "261587350121873408") return;

    const link = /discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/g.exec(rest);
    const channel = link ? msg.client.channels.cache.get(link[2]) : undefined;
    if(link && channel) {
        if(!channel.isText()) return msg.reply("Failed loading link!");
        const msg_ref = await (channel as TextBasedChannel).messages.fetch(link[3]);
        if(!(msg_ref.author.id == KARUTA_ID && msg_ref.content
            && (msg_ref.content.endsWith("is dropping 3 cards!")
                || msg_ref.content == "I'm dropping 3 cards since this server is currently active!"
                || msg_ref.content.includes("This drop has expired and the cards can no longer be grabbed")))) return msg.reply("Not a drop!");

        msg.reply({ embeds: [new MessageEmbed().setDescription(`\`\`\`\n${JSON.stringify(await recognize([...msg_ref.attachments.values()][0].url, true), null, 2)}\n\`\`\``)] });
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

    if(msg.content && msg.content.endsWith("before dropping more cards.")) {
        const m = msg.reference ? await msg.fetchReference() : undefined;
        const replys = [
            "Ist doof jetzt oder? 🤡 ",
            "Sei mal etwas geduldiger! ⌛",
            "Kannst du nicht ein wenig warten? 👿",
            "Versuch es mal lieber später 🌕",
            "Hättest du jetzt gedacht 😯",
            "Schlecht gelaufen 🥱",
            "Brauchst nicht traurig sein 😪",
        ];
        let text = replys[Math.floor(Math.random() * replys.length)];
        if(m?.author.id == "272002648641634304" && Math.random() < 0.4)
            text = replys[0];
        const id = /<@(\d+)>/.exec(msg.content);
        if(!id) return;
        m ? m.reply(text) : msg.channel.send(`<@${id[1]}> ${text}`);

    }
});

