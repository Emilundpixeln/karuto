import { collect } from './collector.js';
import { wl_data } from './shared/klu_data.js'

collect(async (msg) => {
    if(!(
        msg.author.id == "646937666251915264" &&
        msg.embeds.length == 1 &&
        msg.embeds[0].title == "Card Details" 
    )) return;

    let ref = await msg.fetchReference();

    if(ref.content.split(" ").slice(2).find((v) => v == "wl")) {
        let desc = msg.embeds[0].description.replaceAll("~~", "").split("·");
        let series = desc[desc.length - 2].trim();
        let char_bold = desc[desc.length - 1].trim();
        let char = char_bold.substr(2, char_bold.length - 4);
        let wl_dat = wl_data?.[series]?.[char] ?? { wl: 0, date: 0 };
        msg.reply(`\`♡${wl_dat.wl}\`${Date.now() - wl_dat.date < 1000 * 60 * 60 * 24 * 7 ? "" : " ⌛"}`)
    }

})