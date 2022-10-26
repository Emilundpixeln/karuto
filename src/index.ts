import Discord, { MessageComponentInteraction } from "discord.js"
import MessageCollector, { get_commands_json } from "./collector.js"
import { BOT_TOKEN, enable_search } from "./config.js";
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';

const client = new Discord.Client({intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_MESSAGE_REACTIONS", "GUILD_PRESENCES"]});

client.on("messageCreate", async function(message) { 
    MessageCollector.on_message(message);
}); 

client.on("messageUpdate", async function(oldMessage, message) { 
    MessageCollector.on_message_update(oldMessage, message);
});  

client.on("presenceUpdate", async function(oldPresence, newPresence) { 
    MessageCollector.on_presence_update(oldPresence, newPresence);
});

client.on("messageDelete", function(message){
    MessageCollector.on_message_delete(message);
});

client.on("interactionCreate", async interaction => {
    MessageCollector.on_interaction(interaction);

    if(interaction.isMessageComponent()) {
        // TODO fix this (write my own synchronous Interaction collector)
        setTimeout(() => {
            let i = interaction as MessageComponentInteraction;
            if(!i.deferred && !i.replied) {
                console.log("defering ", i)
                i.deferUpdate();
            }
        }, 200);
    }
});



client.login(BOT_TOKEN).then(_ => MessageCollector.on_init(client));


import "./resolve.js"
if(enable_search)
{
    import("./search.js")
}
import "./debug.js"
import "./spot_sync.js"
import "./deleted_messages.js"
import "./age.js"
import "./alias.js"
import "./script.js"
import "./kv_wl.js"
import "./melon_ping.js"
import "./id.js"
import "./frame.js"
import "./datecd.js"
import "./datesolver.js"
import "./historic_images.js"
import "./card_preview.js"
import "./util.js"
import "./image.js"
import "./admin.js"
//import "./timezone.js"
import "./ocr.js"





const rest = new REST({ version: '9' }).setToken(BOT_TOKEN);
rest.put(
    Routes.applicationCommands("959864966725390388"),
    { body: get_commands_json() },
);