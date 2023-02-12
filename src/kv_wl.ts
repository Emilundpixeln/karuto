import { collect } from './collector.js';
import { wl_data, wl_data_too_new } from './shared/klu_data.js'
import { KARUTA_ID } from './constants.js'

collect(async (msg) => {
    if(!(
        msg.author.id == KARUTA_ID &&
        msg.embeds.length == 1 &&
        msg.embeds[0].title == "Card Details" 
    )) return;

    let ref = await msg.fetchReference();

    if(ref.content.split(" ").slice(2).find((v) => v == "wl")) {
        let desc_lines = msg.embeds[0].description.replaceAll("~~", "").split("\n\n");
        let card_info_line = desc_lines[0].startsWith("Owned by <@")/*kci*/ ? 1 : 0;
        let desc = desc_lines[card_info_line].split("·");
        let series = desc[desc.length - 2].trim();
        let char_bold = desc[desc.length - 1].trim();
  
        let alias = /\*\(alias of \*\*(.*)\*\*\)\*/g.exec(char_bold);
        let char = alias ? alias[1] : char_bold.substr(2, char_bold.length - 4);
        let wl_dat = wl_data?.[series]?.[char];
        if(wl_dat)
            msg.reply(`\`♡${wl_dat.wl != wl_data_too_new ? wl_dat.wl : "[NEW]"}\`${Date.now() - wl_dat.date < 1000 * 60 * 60 * 24 * 7 ? "" : " ⌛"}`);
        else
            msg.reply("No Data (Card is aliased?)");
    }

});