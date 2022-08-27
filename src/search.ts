import { readFileSync, createWriteStream, createReadStream, readdirSync, ReadStream, WriteStream } from "fs"
import Discord, { Collector, MessageEmbed } from "discord.js"
import { execFile } from "child_process" 
import { promisify } from "util" 
import { collect_by_prefix } from "./collector.js"

const execFileP = promisify(execFile);
  

type Card = {
    print: number;
    wl: number;
    card_id: string;
    name: string;
    series: string;
    edition: number;
    owner: string;
};


type PastMessage = { 
    msg: Discord.Message<boolean>,
    index: number,
    pages: Array<{
        cards: Array<Card>,
        embeds: Array<MessageEmbed>,
    }>,
    collector: Discord.InteractionCollector<Discord.MessageComponentInteraction<Discord.CacheType>>
};
let past_messages: Array<PastMessage> = [];

let join_max_size = (lines: Array<string>, length: number, seperator: string = "\n"): Array<string> => {
    let ret: Array<string> = [];
    let cur_text = "";
    do {
        let m = lines.shift();
        if(m.length + cur_text.length + seperator.length < length) {
            cur_text += seperator + m;
        } else {
            ret.push(cur_text);
            cur_text = m;
        }
    } while(lines.length > 0);
    if(cur_text.length > 0)
    ret.push(cur_text);
    return ret;
}

let join_max_size_2 = <T>(lines: Array<T>, to_string: (t: T) => string, length: number, seperator: string = "\n"): Array<{ str: string, objects: Array<T> }> => {
    let ret: Array<{ str: string, objects: Array<T> }> = [];

    let cur_text = "";
    let cur_obj: Array<T> = [];
    do {
        let m = lines.shift();
        let str = to_string(m);
        if(str.length + cur_text.length + seperator.length < length) {
            cur_text += seperator + str;
            cur_obj.push(m)
        } else {
            ret.push({ str: cur_text, objects: cur_obj });

            cur_text = str;
            cur_obj = [ m ];
        }
    } while(lines.length > 0);
    if(cur_text.length > 0)
        ret.push({ str: cur_text, objects: cur_obj });
    return ret;
}

let update_message = async (pm: PastMessage, inter: Discord.MessageComponentInteraction<Discord.CacheType> = undefined /* edit msg on interaction instead */) => {

    const row = new Discord.MessageActionRow()
        .addComponents(
            new Discord.MessageButton()
                .setCustomId('first')
                .setLabel('⏪')
                .setStyle('SECONDARY')
                .setDisabled(pm.index == 0),
            new Discord.MessageButton()
                .setCustomId('previous')
                .setLabel('◀️')
                .setStyle('SECONDARY')
                .setDisabled(pm.index == 0),
            new Discord.MessageButton()
                .setCustomId('next')
                .setLabel('▶️')
                .setStyle('SECONDARY')
                .setDisabled(pm.index == pm.pages.length - 1),
            new Discord.MessageButton()
                .setCustomId('last')
                .setLabel('⏩')
                .setStyle('SECONDARY')
                .setDisabled(pm.index == pm.pages.length - 1),
        );

    let body = { embeds: pm.pages[pm.index].embeds, components: [ row ]};
    if(inter)
        inter.update(body);
    else
        pm.msg.edit(body);
}
let on_interaction = async (i: Discord.MessageComponentInteraction<Discord.CacheType>, pm: PastMessage) => {
    console.log("interaction", i.customId, pm.index);
    if(i.customId == "first" && pm.index != 0) {
        pm.index = 0;
        update_message(pm, i);
    } else if(i.customId == "previous" && pm.index != 0) {
        pm.index -= 1;
        update_message(pm, i);
    } else if(i.customId == "next" && pm.index != pm.pages.length - 1) {
        pm.index += 1;
        update_message(pm, i);
    } else if(i.customId == "last" && pm.index != pm.pages.length - 1) {
        pm.index =  pm.pages.length - 1;
        update_message(pm, i);
    }
}



collect_by_prefix("os", async (message, content) => {
    if (message.author.bot) return;
    let query = content.trim();

    let my_message_p = message.reply({ embeds: [new MessageEmbed().setColor(0x2b05eb).setTitle("Searching ...")] } );
    console.log(query);
    execFileP("Search.exe", query.split(" ")).then(async (value: { stdout: string, stderr: string }) => {
        let my_message = await my_message_p;
        
        if(value.stderr.length > 0) {
            console.log(`Error: ${value.stderr}`);

            my_message.edit({ embeds: [new MessageEmbed().setColor(0x991128).setTitle(`Error: ${value.stderr}`)] });
        }
        else {
            console.log(value.stdout.slice(0, 10000));
            let lines = value.stdout.split("\n");
            let matches = Number(lines[0]);


            const cards = lines.slice(1, -1).map((line) => {
                let parts = line.split("\t");

                return {
                    print: Number(parts[0]),
                    wl: Number(parts[1]),
                    card_id: parts[2],
                    name: parts[3],
                    series: parts[4],
                    edition: Number(parts[5]),
                    owner: parts[6].trimRight(),
                };
            });
            if(past_messages.length >= 10) {
                let destroy = past_messages.shift();
                destroy.collector.stop();
            }

            let paged = join_max_size_2(cards, (c: Card) => `\`${c.card_id}\` · \`#${c.print}\`  · \`◈${c.edition}\` · ${c.series} · ${c.name} · <@${c.owner}>`, 3000);
            let collector = my_message.createMessageComponentCollector({ time: 10 * 60 * 1000 });
            let pm = { msg: my_message, index: 0, collector, pages: paged.map((page, i) => ({ 
                cards: page.objects,
                embeds: [ new MessageEmbed({ description: page.str }).setColor(0x00FFFF).setTitle(`Search matched ${matches} card${matches == 1 ? "" : "s"}   Page ${i + 1}/${paged.length}`) ],
            }))}
            past_messages.push(pm);
     
            collector.on("collect", i => on_interaction(i, pm));
        
            update_message(pm);
        }
 
    });   
});

collect_by_prefix("mc", async (message, content) => {

    if (message.type !== 'REPLY')  return;

    let template = "Hi is your % for sell?"
    let rest = content.trim();
    if(rest.length > 0 && rest.includes("%"))
        template = rest;
    
    const msg1 = await message.fetchReference();
    let past_msg = past_messages.find((msg) => msg.msg.id == message.reference.messageId);
   // console.log(past_msg);
   // console.log(msg1);
    if(past_msg == undefined) return;
    let cards = past_msg.pages[past_msg.index].cards;
    let ids = join_max_size(cards.map((card) => card.owner).filter((v, i, a) => a.indexOf(v) === i), 3800, " ");
    let messages = cards.map((c) => {
        let card_msg = `\`${c.card_id}\` · \`#${c.print}\`  · \`◈${c.edition}\` · ${c.series} · ${c.name}`;
        return `<@${c.owner}> ${template.replace("%", card_msg)}`; 
    });
  //  console.log(messages);
    let embeds = [
        ...ids.map((id) => new MessageEmbed({ description: id })),
        ...join_max_size(messages, 3000).map((str) => new MessageEmbed({ description: str })).slice(0, 2)
    ];

  //  console.log(embeds);
    message.reply({ embeds });
});