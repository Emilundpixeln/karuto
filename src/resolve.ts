import { readFileSync } from "fs"
import fetch from "node-fetch-commonjs"
import Discord, { CommandInteraction } from "discord.js"
import { SlashCommandBuilder } from "@discordjs/builders"
import { collect_by_prefix, register_command } from "./collector.js"
import { rest_no_bot } from "./index.js"
import { RoutesTypings, Routes } from "./discordjs_rest_typings.js"
import { REST } from "@discordjs/rest"


let token = JSON.parse(readFileSync("token.json", { encoding: "utf-8" })).token;
let resolve = async (user_id: string, guild_id: string) => {

    let json = await rest_no_bot.get<"guildMessageSearch">(Routes.guildMessageSearch(guild_id), {
        query: new URLSearchParams({
            author_id: user_id
        })
    });

    if(json.total_results == 0)
        return;
    console.log(json);
    let m = json.messages[0][0];

    return `https://discord.com/channels/${guild_id}/${m.channel_id}/${m.id}`;
}

let resolve_s = async (client: Discord.Client, guild_id: string) => {
    let json_guild = await client.fetchGuildPreview(guild_id).catch(_ => null);
    if(!json_guild) return undefined;

    let embed = new Discord.MessageEmbed().setTitle(json_guild.name).setThumbnail(`https://cdn.discordapp.com/icons/${guild_id}/${json_guild.icon}.webp?size=256`).setFields(
        { name: "Members", value: `${json_guild.approximateMemberCount}`, inline: true },
    );

    if(json_guild.description)
        embed.setDescription(json_guild.description);
    return { embeds: [ embed ] }
 
}

collect_by_prefix("oresolve", async (message, content) => {
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
        let input = /(\d+)/g.exec(inter.options.getString("id", true));
        if(!input) return inter.reply("Not a user id");

        let resp = await resolve(input[1], "648031568756998155");
        if(resp)
            inter.reply(resp);
        else 
            inter.reply("Didn't find user");
    }
);

collect_by_prefix("oresolves", async (message, content) => {
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
        let input = /(\d+)/g.exec(inter.options.getString("id", true));
        if(!input) return  inter.reply("Not a guild id");
    
        let resp = await resolve_s(inter.client, input[1]);
        if(resp)
            inter.reply(resp);
        else
            inter.reply("Server is not discoverable or doesn't exist.");
    }
);
