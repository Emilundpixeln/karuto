import { readFileSync } from "fs"
import fetch from "node-fetch-commonjs"
import Discord, { CommandInteraction } from "discord.js"
import { SlashCommandBuilder } from "@discordjs/builders"
import { collect_by_prefix, register_command } from "./collector.js"

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
        total_results: number,
        messages: Array<[ {
            id: string,
            channel_id: string
        }]>
    };
    if(json.total_results == 0)
        return;
    console.log(json);
    let m = json.messages[0][0];

    return `https://discord.com/channels/${guild_id}/${m.channel_id}/${m.id}`;
}

let resolve_s = async (client: Discord.Client, guild_id: string) => {

    try {
        let json_guild = await client.fetchGuildPreview(guild_id);
    
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


register_command(
    new SlashCommandBuilder()
        .setName("resolve")
        .setDescription("Find User")
        .addStringOption(option => option.setName("id")
                                    .setDescription("User id")
                                    .setRequired(true)),
    async (inter) => {
        let input = /(\d+)/g.exec(inter.options.getString("id"));
        if(!input) return inter.reply("Not a user id");

        let resp = await resolve(input[1], "648031568756998155");
        if(resp)
            inter.reply(resp);
        else 
            inter.reply("Didn't find user");
    }
);

collect_by_prefix("oresolves", async (message: Discord.Message<boolean> | Discord.PartialMessage, content: string) => {
    if(message.author.bot) return;

    let input = /(\d+)/g.exec(content.trim());
    if(!input) return;

    let resp = await resolve_s(message.client, input[1]);
    if(resp)
        message.reply(resp);
    else
        message.reply("Server is not discoverable or doesn't exist.");
});

register_command(
    new SlashCommandBuilder()
        .setName("resolve_server")
        .setDescription("Find Server")
        .addStringOption(option => option.setName("id")
                                    .setDescription("Guild id")
                                    .setRequired(true)),
    async (inter) => {
        let input = /(\d+)/g.exec(inter.options.getString("id"));
        if(!input) return  inter.reply("Not a guild id");
    
        let resp = await resolve_s(inter.client, input[1]);
        if(resp)
            inter.reply(resp);
        else
            inter.reply("Server is not discoverable or doesn't exist.");
    }
);
