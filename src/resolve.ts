import { readFileSync } from "fs"
import fetch from "node-fetch-commonjs"
import Discord from "discord.js"
import { collect_by_prefix } from "./collector.js"

let token = JSON.parse(readFileSync("token.json", { encoding: "utf-8" })).token;

let resolve = async (user_id: string, guild_id: string) => {

    let res = await fetch(`https://discord.com/api/v9/guilds/${guild_id}/messages/search?author_id=${user_id}`, {
        "headers": {
            "accept": "*/*",
            "accept-language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
            "authorization": token,
            "cache-control": "no-cache",
            "pragma": "no-cache",
            "sec-ch-ua": "\"Google Chrome\";v=\"105\", \"Not)A;Brand\";v=\"8\", \"Chromium\";v=\"105\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Windows\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-debug-options": "bugReporterEnabled",
        },
        "body": null,
        "method": "GET"
    });


    let json = await res.json() as {
        total_matches: number,
        messages: Array<[ {
            id: string,
            channel_id: string
        }]>
    };
    if(json.total_matches == 0)
        return;

    let m = json.messages[0][0];

    return `https://discord.com/channels/${guild_id}/${m.channel_id}/${m.id}`;
}

let resolve_s = async (message: Discord.Message<boolean> | Discord.PartialMessage, guild_id: string) => {

    try {
        let json_guild = await message.client.fetchGuildPreview(guild_id);
    
        let embed = new Discord.MessageEmbed().setTitle(json_guild.name).setThumbnail(`https://cdn.discordapp.com/icons/${guild_id}/${json_guild.icon}.webp?size=256`).setFields(
            { name: "Members", value: `${json_guild.approximateMemberCount}`, inline: true },
        );
    
        if(json_guild.description)
            embed.setDescription(json_guild.description);
        return { embeds: [ embed ] }
    } catch (error) {
        return;
    }

}

collect_by_prefix("oresolve", async (message: Discord.Message<boolean> | Discord.PartialMessage, content: string) => {
    if(message.author.bot) return;

    let input = /(\d+)/g.exec(content.trim());
    if(!input) return;

    let resp = await resolve(input[1], "648031568756998155");
    if(resp)
        message.reply(resp);
});

collect_by_prefix("oresolves", async (message: Discord.Message<boolean> | Discord.PartialMessage, content: string) => {
    if(message.author.bot) return;

    let input = /(\d+)/g.exec(content.trim());
    if(!input) return;

    let resp = await resolve_s(message, input[1]);
    if(resp)
        message.reply(resp);
    else
        message.reply("Server is not discoverable or doesn't exist.");
});
