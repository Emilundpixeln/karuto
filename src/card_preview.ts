import Discord from "discord.js"
import fetch from "node-fetch"
import { url_to_ident, klu_data } from "./shared/klu_data.js"
import { collect, collect2, Deleter, hook_message_updates } from "./collector.js"
import { KARUTA_ID } from './constants.js'

type Card = {
    name: string;
    series: string;
    edition: string;

}

function guesses(c: Card): Array<string> {
    let url = klu_data?.[c.series]?.[c.name];
    if(!url) return [];
    let ident = url_to_ident(url);
    return [ 
        `http://d2l56h9h5tj8ue.cloudfront.net/images/cards/versioned/${ident}-${c.edition}-3.jpg`,
        `http://d2l56h9h5tj8ue.cloudfront.net/images/cards/versioned/${ident}-${c.edition}-2.jpg`,
        `http://d2l56h9h5tj8ue.cloudfront.net/images/cards/versioned/${ident}-${c.edition}-1.jpg`,
        `http://d2l56h9h5tj8ue.cloudfront.net/images/cards/${ident}-${c.edition}.jpg`,
    ]
}

async function getUrl(s: Card): Promise<string> {
    let guesses_list = guesses(s);
    if(guesses_list.length == 1) return guesses_list[0];
    for(let guess of guesses_list) {
        if((await fetch(guess, { method: "HEAD" })).status == 200)
            return guess;
    }
    console.error("Couldn't find:", s);
    return undefined;
}
type Track = {
    channel: Discord.AnyChannel;
    my_message: Promise<Discord.Message>;
    current_cards: Array<Card>;
    deleter: Deleter;
};

let tracked_messages: Map<string, Track> = new Map();

collect2(message => message.author.id == KARUTA_ID
    && message.embeds.length >= 1 && message.embeds[0].description
    && (message.embeds[0].description.startsWith("Cards carried by") 
    || message.embeds[0].description.startsWith("Burn Cards")
    || message.embeds[0].title.startsWith("Character Results")), message => {

    let collecter = message.createReactionCollector({ filter: (reac, user) => reac.emoji.name == "🔎", dispose: true });
    
    collecter.on("collect", (reac) => {
        if (tracked_messages.has(message.id)) return;

        tracked_messages.set(message.id, {
            channel: message.channel,
            my_message: undefined,
            current_cards: [],
            deleter: null,
        });
        tracked_messages.get(message.id).deleter = hook_message_updates(message, () => onEdit(tracked_messages.get(message.id), message), 4 * 60 * 1000);
    });

    collecter.on("dispose", async (reac) => {
        if(reac.count != 0) return;
        let track = tracked_messages.get(message.id);
        if(!track) return;
        track.deleter();
        (await track.my_message).delete();
        tracked_messages.delete(message.id);
    })

});

async function onEdit(track: Track, message: Discord.Message<boolean> | Discord.PartialMessage) {
    let text: Array<string>;
    let fix_ed = false;
    if(message.embeds[0].description.startsWith("Cards carried by") || message.embeds[0].description.startsWith("Burn Cards")) {
        text = message.embeds[0].description.split("\n").slice(2);
    } else if(message.embeds[0].title.startsWith("Character Results")) {
        text = message.embeds[0].fields[0].value.split("\n");
        fix_ed = true;
    } else {
        return;
    }
    let cards: Array<Card> = text.map((s, i) => {

        let parts = s.replaceAll("~~", "").split("·");
        if(parts.length == 1) return;
        if(parts.length < 3) {
            console.error("parse error", parts);
            return
        }
        return {
            name: parts[parts.length - 1].substr(3, parts[parts.length - 1].length - 3 - 2),
            edition: fix_ed ? "1" : parts[parts.length - 3].replaceAll(/[^\d]/g, ""),
            series: parts[parts.length - 2].trim()
        };
    });
    track.current_cards = cards;


    update_message(track);
}


async function update_message(track: Track) {
    const url_cards = (await Promise.all(track.current_cards.map(async (s) => { return { url: await getUrl(s), card: s }; })));
    const max_size = Math.min(45, Math.round(0.8 * Math.max(...url_cards.map((url_card) => Math.max(url_card.card.name.length / 14.0 * 16.0, (url_card.card.series.length + 3) )))));
    const embeds = url_cards.map((url_card) => new Discord.MessageEmbed()
            .setColor('#0099ff')
            .setDescription(`[◈${url_card.card.edition} ${url_card.card.series}\n${"\u2800".repeat(max_size)}](${url_card.url})`)
            .setTitle(`${url_card.card.name}`)
            .setThumbnail(url_card.url));

    track.my_message = track.my_message ? (await track.my_message).edit({ embeds }) : track.channel["send"]({ embeds });
}


