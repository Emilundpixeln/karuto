import { collect, collect_by_prefix, MessageType } from "./collector.js";
import { unlink, createWriteStream, existsSync } from 'fs';
import client from 'https';
import { execFile } from "child_process" 
import { promisify } from "util" 
import { MessageEmbed, MessageActionRow, ButtonInteraction, MessageButton } from "discord.js";
import { MessageHandler } from "./message_handler.js"

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

let solve = async (m: MessageType, url: string, get_ring: boolean, my_message: MessageHandler) => {
    let path = `tmp/${Math.random().toString().padEnd(19, "0").slice(2)}.png`;
    try {
        await downloadImage(url, path);
        
        await execFileP("datesolver.exe", get_ring ? [path] : ["-noring", path]).then(async (value: { stdout: string, stderr: string }) => {
            
            let lines = value.stdout.split("\r\n");
            
            if(lines.length < 19)
            {
                my_message.reply(m, "Something went wrong...");
                console.error(lines);
                return
            }
            console.error(lines);
            let board = lines.slice(1, 16).map((s) => s.split(":")[1]);
            let car = lines[16];
            let path = lines[17];
            let ap = parseInt(lines[18]);
            
            let path_has_ring = path.includes("W");
            
            let text = `${path.trim().split(" ")
                .map((s) => s.startsWith("@") 
                    ? ((s[1] == "L") ? `**[Take Left:**${to_emoji(s[2])}**]**` : `**[Take Right:**${to_emoji(s[2])}**]**`) 
                    : to_emoji(s))
                .join(" ")} + ${(ap % 1000)} AP ${ap >= 1000 ? " + :ring:" : ""}`;
            let board_text = board.map((line, y) => line.split("")
            .map((c, x) => y == 14 && x == 5 ? to_emoji(car.includes("left") ? "left" : "right"): to_emoji(c)).join(" ")).join("\n");
            
            const row = new MessageActionRow()
			.addComponents(
                new MessageButton()
                .setCustomId(get_ring ? 'no-ring' : 'ring')
                .setLabel(get_ring ? 'No Ring' : 'With Ring')
                .setStyle('SECONDARY')
                );
                
                
                my_message.reply(m, {
                    embeds: [
                        new MessageEmbed().setTitle(`Date solution${path_has_ring || !get_ring ? (get_ring ? " with Ring" : " without Ring") : ""}`).setDescription(text),
                        new MessageEmbed().setTitle("Recognized board").setDescription(board_text)
                    ],
                    components: path_has_ring || !get_ring ? [row] : []
                })
                let target = get_ring ? 'no-ring' : 'ring';
                const collector = (await my_message.message).createMessageComponentCollector({ filter: (i) => i.customId == target && i.user.id == m.author.id, time: 15000 });
                
                collector.once('collect', async i => {
                    my_message.defer_on_edit(i);
                    solve(m, url, !get_ring, my_message);
                });
            })
            .finally(() => {
                unlinkP(path);
            });
    } catch (error) {
        my_message.reply(m, "Something went wrong...");
        console.error(error);
        if(existsSync(path))
            unlinkP(path);
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
    solve(m, url, true,  new MessageHandler());
});

collect((message) => {
    if(!(message.author.id == "646937666251915264" && message.embeds.length > 0
    && message.embeds[0].title == "Date Minigame" )) return;
    if(message.channelId != "932714352589541376") return;
    
    let url = message?.embeds?.[0]?.image?.url;
    if(url)
        solve(message, url, true, new MessageHandler());
})