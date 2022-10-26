import { collect, collect_by_prefix, collect_transition, get_most_recent_message, MessageType, register_command, SlashCommand } from "./collector.js";
import { unlink, createWriteStream, existsSync } from 'fs';
import client from 'https';
import { execFile } from "child_process" 
import { promisify } from "util" 
import { MessageEmbed, MessageActionRow, MessageButton, MessageManager } from "discord.js";
import { MessageHandler } from "./message_handler.js"
import { KARUTA_ID } from "./constants.js"

const execFileP = promisify(execFile);
const unlinkP = promisify(unlink);

function downloadImage(url, filepath): Promise<void> {
    return new Promise((resolve, reject) => {
        client.get(url, (res) => {
            res.pipe(createWriteStream(filepath));
            res.on("close", () => resolve());
        });
    })
}

let to_emoji = (char: string) => {
    switch(char) {
    case '_':
		return ":evergreen_tree:"
	case 'G':
		return ":fuelpump:"
	case 'I':
		return ":spaghetti:";
	case 'T':
		return ":taco:";
	case 'S':
		return ":sandwich:";
	case 'P':
		return ":ferris_wheel:";
	case 'J':
		return ":beverage_box:"
	case 'C':
		return ":coffee:";
	case 'N':
		return ":tropical_drink:"
	case 'F':
		return ":blossom:"
	case 'D':
		return ":dancer:"
	case 'R':
		return ":performing_arts:";
	case 'A':
		return ":airplane:"
	case 'W':
		return ":ring:"
	case 'O':
		return ":shopping_bags:";
	case 'H':
		return ":house_with_garden:";
	case ' ':
		return ":black_large_square:";
	case '#':
		return ":green_square:";
    case "up":
        return ":arrow_up_small:";
    case "down":
        return ":arrow_down_small:";
    case "left":
        return ":arrow_backward:";
    case "right":
        return ":arrow_forward:";
	default:
		return ":question:";
    }
}
let run_solve = async (args: string[]) => {
    let { stdout, stderr } = await execFileP("datesolver.exe", args);

            
    let lines = stdout.split("\r\n");
    
    if(lines.length < 19 || stdout.includes("[error]"))
    {
        console.error(lines);
        return undefined;
    }
    console.log("datesolver.exe", args);
    let board_lines = lines.slice(1, 16);
    return {
        board_lines,
        board: lines.slice(1, 16).map((s) => s.split(":")[1]),
        car: lines[16],
        path: lines[18],
        ap: parseInt(lines[19]),
        board_has_ring: lines.slice(1, 16).includes("W"),
        path_has_ring: lines[18].includes("W"),
        exchange_key: lines[17]
    }
}

let solve = async (m: MessageType, author: string, url_or_key: string, get_ring: boolean, my_message: MessageHandler) => {
    let is_img = url_or_key.includes("https://dhp5ttvnehc80.cloudfront.net/");
    let img_path = undefined;
    try {
        let args = [];
        if(!get_ring)
            args.push("-noring");
      

        if(is_img) {
            img_path = `tmp/${Math.random().toString().padEnd(19, "0").slice(2)}.png`;
            await downloadImage(url_or_key, img_path);
            args.push(img_path);
        } else {
            args.push("-key", url_or_key);
        }
        let vals = await run_solve(args);
        if(!vals)
        {
            my_message.reply(m, "Something went wrong...");
            return
        }

        
        let board_has_ring = vals.board_lines.reduce((p, c) => p || c.includes("W"), false);
        let path_has_ring = vals.path.includes("W");
        let date_fail = false; 

        if(board_has_ring && !path_has_ring && get_ring) {
            let force_vals = await run_solve(["-force_ring", "-key", vals.exchange_key]);

            if(force_vals.path.includes("W")) {
                vals = force_vals;
                date_fail = true;
                board_has_ring = true;
                path_has_ring = true;
            }
    
        }

        
        let text = `${vals.path.trim().split(" ")
            .map((s) => s.startsWith("@") 
                ? ((s[1] == "L") ? `**[Take Left:**${to_emoji(s[2])}**]**` : `**[Take Right:**${to_emoji(s[2])}**]**`) 
                : to_emoji(s))
            .join(" ")} + ${(vals.ap % 1000)} AP ${vals.ap >= 1000 ? " + :ring:" : ""} ${date_fail ? " *Date will fail for ring*" : ""}`;
        let board_text = vals.board.map((line, y) => line.split("")
        .map((c, x) => y == 14 && x == 5 ? to_emoji(vals.car.includes("left") ? "left" : "right"): to_emoji(c)).join(" ")).join("\n");
        
        const row = new MessageActionRow();
        let target = "datesolve button"; //Math.random().toString().padEnd(19, "0").slice(2);
        if(get_ring)
            row.addComponents(
                new MessageButton()
                .setCustomId(target)
                .setLabel('No Ring')
                .setStyle('SECONDARY')
            );
        else 
            row.addComponents(
                new MessageButton()
                .setCustomId(target)
                .setLabel('With Ring')
                .setStyle('SECONDARY')
            );
            
        my_message.reply(m, {
            embeds: [
                new MessageEmbed().setTitle(`Date solution${path_has_ring || !get_ring ? (get_ring ? " with Ring" : " without Ring") : ""}`).setDescription(text),
                new MessageEmbed().setTitle("Recognized board").setDescription(board_text)
            ],
            components: path_has_ring || !get_ring ? [row] : []
        })

        const collector = (await my_message.message).createMessageComponentCollector({ filter: (i) => i.customId == target && i.user.id == author || (i.deferUpdate(), false), time: 4 * 60 * 1000 });
        
        collector.once('collect', i => {
            console.log(`solve with exchange key ${vals.exchange_key}`);
            my_message.defer_on_edit(i);
            collector.stop();
            solve(m, author, vals.exchange_key, !get_ring, my_message);
        });

        if(img_path != undefined)
            unlinkP(img_path);
   
    } catch (error) {
        my_message.reply(m, "Something went wrong...");
        console.error(error);
        if(img_path != undefined && existsSync(img_path))
            unlinkP(img_path);
    }

}

collect_by_prefix("odate", async (m, cont) => {
    let url = undefined;
    if(m.reference) {
        let msg = await m.fetchReference();
        url = msg?.embeds?.[0]?.image?.url;
    }
    url = url ?? cont.trim();

    if(!url)
        return;
    solve(m, m.author.id, url, true, new MessageHandler());
});

register_command(new SlashCommand().setName("date").setDescription("solve a date"), (i) => {

    let msg = get_most_recent_message(i.channel.messages, (message) => {
        if(!(message.author.id == KARUTA_ID && message.embeds.length > 0
        && message.embeds[0].title == "Date Minigame" )) return false;
        let visitor = /<@(\d+)>/g.exec(message.embeds[0].description);
        return visitor && visitor[1] == i.user.id;
    });
    if(!msg) i.reply("No recent date found");
    else {
        solve(msg, i.user.id, msg?.embeds?.[0]?.image?.url, true, new MessageHandler(i));
    }
});

let whereami = (my_msg: MessageHandler, reply_to: MessageType, inp_time: number, messages_for_search: MessageManager) => {
    let msg = get_most_recent_message(messages_for_search, (message) => message.author.id == messages_for_search.client.user.id && message.embeds.length > 0
     && ["Date solution", "Date solution with Ring", "Date solution without Ring"].includes(message.embeds[0].title));
    if(!msg) my_msg.reply(reply_to, "No recent date solution found");
    else {
        let removes = 25 - Math.floor(inp_time / 4);
        let rest = msg.embeds[0].description;
        while(removes > 0) {
            let i = rest.indexOf(" ");
            if("LR".includes(rest.charAt(i + 1)))
                i = rest.indexOf(" ");
            rest = rest.substr(i + 1);
            removes -= 1;
        }
        if((rest.split("+")[0].match(/:/g) || []).length != 2 * Math.floor(inp_time / 4)) {
            console.log(inp_time, rest);
            console.log(msg.embeds[0].description, (rest.split("+")[0].match(/:/g) || []).length);
            console.log("Error");
            return;
        }
        my_msg.reply(reply_to, { embeds: [ new MessageEmbed().setTitle(`Date Solution with remaining time ${inp_time}`).setDescription(rest) ] });
    }
}

register_command(new SlashCommand().setName("whereami").setDescription("Find remaining steps in a date")
    .addIntegerOption(option => option.setName("time").setDescription("Remaining Time ⌛").setMinValue(0).setMaxValue(100).setRequired(true)), (i) => {
    
    whereami(new MessageHandler(i), undefined, i.options.getInteger("time"), i.channel.messages);
});

collect_by_prefix("owhereami", (user_message, cont) => {
    let time = Number.parseInt(cont);

    if(!(cont && time >= 0 && time <= 100)) {
        user_message.reply("Enter the remaing time");
        return;
    }
    whereami(new MessageHandler(), user_message, time, user_message.channel.messages);
});


collect(async (message) => {
    if(!(message.author.id == KARUTA_ID && message.embeds.length > 0
    && message.embeds[0].title == "Date Minigame" )) return;
    if(message.channelId != "932714352589541376") return;
    
    let url = message?.embeds?.[0]?.image?.url;
    if(url)
        solve(message, (await message.fetchReference()).author.id, url, true, new MessageHandler());
});

collect_transition(async (message, old_message) => {
    if(!(message.author.id == KARUTA_ID && message.embeds.length > 0
    && message.embeds[0].title == "Date Minigame" )) return;
    if(message.channelId != "932714352589541376") return;

    if(!(old_message.author.id == KARUTA_ID && old_message.embeds.length > 0
    && old_message.embeds[0].title == "Visit Character")) return;
    if(old_message.channelId != "932714352589541376") return;
    let date_ask_regex = /You are about to spend `\d` Energy to ask \*\*.*\*\* out on a date.\nBased on your \*\*Affection Rating\*\*, there is a `.*` chance they will accept./;
    if(!date_ask_regex.exec(old_message.embeds[0].description)) return;
    
    let url = message?.embeds?.[0]?.image?.url;
    if(url)
        solve(message, (await message.fetchReference()).author.id, url, true, new MessageHandler());
})