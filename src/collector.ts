import Discord, { Options, CommandInteraction, MessageManager, TextBasedChannel } from "discord.js"
import { SlashCommandBuilder } from "@discordjs/builders"

export let is_reply_to_command = async (m: MessageType, commands: string[]) => {
    if(!m.reference) return;
    let a = (await m.fetchReference()).content.split(" ");
    return a.length > 0 && commands.map(c => a[0].includes(c)).reduce((c, v) => c || v, false);
}

type MessageCollector = 
{
    filter: (message: MessageType) => boolean,
    callback: (message: MessageType) => void,
    init: () => void,
    trigger_on_message_update: boolean,
}
type MessageUpdateCollector = 
{
    filter: (message: MessageType, old_message: MessageType) => boolean,
    callback: (message: MessageType, old_message: MessageType) => void,
    init: () => void
}
type MessageDeleteCollector = 
{
    filter: (message: MessageType) => boolean,
    callback: (message: MessageType) => void,
    init: () => void
}
type PresenceCollector = 
{
    callback: (old_presence: Discord.Presence, new_presence: Discord.Presence) => void,
}
type ClientCollector = 
{
    callback: (client: Discord.Client) => void,
}



let message_collectors: Array<MessageCollector> = [];
let message_update_collectors: Array<MessageUpdateCollector> = [];
let message_delete_collectors: Array<MessageDeleteCollector> = [];
let presence_collectors: Array<PresenceCollector> = [];
let client_collectors: Array<ClientCollector> = [];

let is_message = (x: any) : x is Discord.Message<boolean> => x.edit != undefined;

export let as_message_or_throw = (msg: Promise<Discord.GuildCacheMessage<Discord.CacheType>>) => msg.then(v => {
    if(is_message(v)) {
        return v;
    }
    throw v;
});

export type MessageType = Discord.Message<boolean> | Discord.PartialMessage;
export type Replyable =  Discord.Message<boolean> | Discord.PartialMessage | Discord.CommandInteraction<Discord.CacheType>;

export let collect = (callback: (message: MessageType) => void, options: { filter?: (message: MessageType) => boolean, init?: () => void, trigger_on_message_update?: boolean } = undefined): void => {
    message_collectors.push({ filter: options?.filter, callback, init: options?.init, trigger_on_message_update: options?.trigger_on_message_update ?? false });
}

export let collect_transition = (callback: (message: MessageType, old_message: MessageType) => void, options: { filter?: (message: MessageType, old_message: MessageType) => boolean, init?: () => void } = undefined): void => {
    message_update_collectors.push({ filter: options?.filter, callback, init: options?.init });
}

export type Deleter = () => void;

export let hook_message_updates = (message: MessageType, callback: (message: MessageType) => void, timeout_ms: number = 60_000): Deleter => {
    let item = { filter: (m: MessageType) => m.id == message.id, callback, init: undefined, trigger_on_message_update: true };
    message_collectors.push(item);
    let deleter = () => message_collectors.filter((m) => m != item);
    setTimeout(deleter, timeout_ms);

    // call with initial state
    callback(message);
    return deleter;
}

let commands = [] as {
    proto: Partial<SlashCommandBuilder>,
    callback: (interaction: CommandInteraction) => void
}[];
export let SlashCommand = SlashCommandBuilder;
export let register_command = (command: Partial<SlashCommandBuilder>, callback: (interaction: CommandInteraction) => void) => {
    commands.push({ proto: command, callback });
}

export let collect2 = (filter: (message: MessageType) => boolean, callback: (message: MessageType) => void, init: () => void = () => {}, trigger_on_message_update: boolean = false): void => {
    message_collectors.push({ filter, callback, init, trigger_on_message_update });
}


export let collect_message_delete = (filter: (message: MessageType) => boolean, callback: (message: MessageType) => void, init: () => void = () => {}): void => {
    message_delete_collectors.push({ filter, callback, init });
}


export let collect_by_prefix_and_filter = (prefix: string, additional_filter: (message: MessageType) => boolean, callback: (message: MessageType, content_after_prefix: string) => void, init: () => void = () => {}): void => {
    collect2((m) => additional_filter(m) 
        && m.content.startsWith(prefix) 
        && (m.content.length == prefix.length || m.content[prefix.length].trim().length == 0), (m) => callback(m, m.content.substr(prefix.length)), init);
}

export let collect_by_prefix = (prefix: string, callback: (message: MessageType, content_after_prefix: string) => void, init: () => void = () => {}): void => {
    collect_by_prefix_and_filter(prefix, (m) => true, (m) => callback(m, m.content.substr(prefix.length)), init);
}

export let collect_presence_updates = (callback: (old_presence: Discord.Presence, new_presence: Discord.Presence) => void) => {
    presence_collectors.push({ callback });
}

export let on_client_available = (callback: (client: Discord.Client) => void) => {
    client_collectors.push({ callback });
}

export let on_message = (message: MessageType): void => {
    message_collectors.map((v) => {
        if(!v.filter || v.filter(message)) v.callback(message);
    });
}

export let on_interaction = (interaction: Discord.Interaction<Discord.CacheType>): void => {
    if(!interaction.isCommand()) return;

    let com = commands.find(v => v.proto.name == interaction.commandName);

    if(com) {
        com.callback(interaction as CommandInteraction);
    }
    else {
        console.error("Didn't find command for", interaction.commandName);
    }
}

export let on_message_update = (old_message: MessageType, message: MessageType): void => {

    message_collectors.map((v) => {
        if(v.trigger_on_message_update && (!v.filter || v.filter(message))) v.callback(message);
    });

    message_update_collectors.map((v) => {
        if(!v.filter || v.filter(message, old_message)) v.callback(message, old_message);
    });
}
export let on_message_delete = (message: MessageType): void => {
    message_delete_collectors.map((v) => {
        if((!v.filter || v.filter(message))) v.callback(message);
    });
}

export let on_presence_update = (old_presence: Discord.Presence, new_presence: Discord.Presence) => {
    presence_collectors.map((v) => {
        v.callback(old_presence, new_presence);
    });
}

export let on_init = (client: Discord.Client): void => {
    message_collectors.map((v) => {
        v.init && v.init();
    });
    message_update_collectors.map((v) => {
        v.init && v.init();
    });
    client_collectors.map((v) => {
        v.callback(client);
    });

}

export let get_commands_json = () => {
    return commands.map(v => v.proto.toJSON());
}

export let get_most_recent_message = (messages: MessageManager, filter: (msg: MessageType) => boolean) => {
    let max = undefined as MessageType;
    messages.cache.map((message, key) => {
        if(max && max.createdTimestamp > message.createdTimestamp) return;
        if(!filter(message)) return;
        max = message;
    });
    return max;
}

export let get_all_messages_untill = async (channel: TextBasedChannel, should_stop: (msg: MessageType) => boolean) => {
    let before = undefined as string;
    let finished = false;
    let i = 0;
    while(!finished)
    {
        let msgs = await channel.messages.fetch(before ? {
            limit: 100,
            before
        } : {
            limit: 100
        });
 
        for (const [id, msg] of msgs) {
            before = id;
          //  console.log(msg.content)
            if(should_stop(msg)) {
                finished = true;
                break
            }
        }
        if(i++ == 100) {
            console.error(`get_all_messages_untill was never told to stopped!`);
            break
        }
    }
}

export let snowflake_to_timestamp = (time: string) => Number((BigInt(time) >> BigInt(22)) + BigInt(1420070400000));

export default {
    on_message, on_init, on_presence_update, on_message_delete, on_message_update, on_interaction, get_commands_json
};