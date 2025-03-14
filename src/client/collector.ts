import Discord, { AutocompleteInteraction, CommandInteraction, MessageManager, TextBasedChannel } from "discord.js";
import { SlashCommandBuilder } from "@discordjs/builders";

export const is_reply_to_command = async (m: MessageType, commands: string[]) => {
    if(!m.reference) return;
    const a = (await m.fetchReference()).content.split(" ");
    return a.length > 0 && commands.map(c => a[0].includes(c)).reduce((c, v) => c || v, false);
};

type MessageCollector =
    {
        filter?: (message: MessageType) => boolean,
        callback: (message: MessageType) => void,
        init?: () => void,
        trigger_on_message_update: boolean,
    }
type MessageUpdateCollector =
    {
        filter?: (message: MessageType, old_message: PartialMessageType) => boolean,
        callback: (message: MessageType, old_message: PartialMessageType) => void,
        init?: () => void
    }
type MessageDeleteCollector =
    {
        filter?: (message: PartialMessageType) => boolean,
        callback: (message: PartialMessageType) => void,
        init?: () => void
    }
type PresenceCollector =
    {
        callback: (old_presence: Discord.Presence | null, new_presence: Discord.Presence) => void,
    }
type ClientCollector =
    {
        callback: (client: Discord.Client) => void,
    }



const message_collectors: Array<MessageCollector> = [];
const message_update_collectors: Array<MessageUpdateCollector> = [];
const message_delete_collectors: Array<MessageDeleteCollector> = [];
const presence_collectors: Array<PresenceCollector> = [];
const client_collectors: Array<ClientCollector> = [];

const is_message = (x: unknown): x is Discord.Message<boolean> => x instanceof Discord.Message;

export const as_message_or_throw = (msg: Promise<Discord.GuildCacheMessage<Discord.CacheType>>) => msg.then(v => {
    if(is_message(v)) {
        return v;
    }
    throw v;
});

export type MessageType = Omit<Discord.Message<boolean>, "_patch" | "partial" | "_cacheType">; //| Discord.PartialMessage;
export type PartialMessageType = Discord.PartialMessage | Discord.Message<boolean>;
export type Replyable = MessageType | PartialMessageType | Discord.CommandInteraction<Discord.CacheType>;

export const collect = (callback: (message: MessageType) => void, options: { filter?: (message: MessageType) => boolean, init?: () => void, trigger_on_message_update?: boolean } | undefined = undefined): void => {
    message_collectors.push({ filter: options?.filter, callback, init: options?.init, trigger_on_message_update: options?.trigger_on_message_update ?? false });
};

export const collect_transition = (callback: (message: MessageType, old_message: PartialMessageType) => void, options: { filter?: (message: MessageType, old_message: PartialMessageType) => boolean, init?: () => void } | undefined = undefined): void => {
    message_update_collectors.push({ filter: options?.filter, callback, init: options?.init });
};

export type Deleter = () => void;

export const hook_message_updates = (message: MessageType, callback: (message: MessageType) => void, timeout_ms = 60_000): Deleter => {
    const item = { filter: (m: MessageType) => m.id == message.id, callback, init: undefined, trigger_on_message_update: true };
    message_collectors.push(item);
    const deleter = () => message_collectors.filter((m) => m != item);
    setTimeout(deleter, timeout_ms);

    // call with initial state
    callback(message);
    return deleter;
};

const commands = [] as {
    proto: Partial<SlashCommandBuilder> & Pick<SlashCommandBuilder, "toJSON">,
    callback: (interaction: CommandInteraction) => void,
    autocomplete: ((interaction: AutocompleteInteraction) => void) | undefined
}[];
export const SlashCommand = SlashCommandBuilder;
export const register_command = (command: Partial<SlashCommandBuilder> & Pick<SlashCommandBuilder, "toJSON">, callback: (interaction: CommandInteraction) => void, autocomplete?: (interaction: AutocompleteInteraction) => void) => {
    commands.push({ proto: command, callback, autocomplete });
};

export const collect2 = (filter: (message: MessageType) => boolean, callback: (message: MessageType) => void, init: () => void = () => { }, trigger_on_message_update = false): void => {
    message_collectors.push({ filter, callback, init, trigger_on_message_update });
};


export const collect_message_delete = (filter: (message: PartialMessageType) => boolean, callback: (message: PartialMessageType) => void, init: () => void = () => { }): void => {
    message_delete_collectors.push({ filter, callback, init });
};


export const collect_by_prefix_and_filter = (prefix: string, additional_filter: (message: MessageType) => boolean, callback: (message: MessageType, content_after_prefix: string) => void, init: () => void = () => { }): void => {
    collect2((m) => m.content != null && additional_filter(m)
        && m.content.startsWith(prefix)
        && (m.content.length == prefix.length || m.content[prefix.length].trim().length == 0), (m) => callback(m, m.content?.substring(prefix.length) ?? ""), init);
};

export const collect_by_prefix = (prefix: string, callback: (message: MessageType, content_after_prefix: string) => void, init: () => void = () => { }): void => {
    collect_by_prefix_and_filter(prefix, _ => true, m => callback(m, m.content?.substring(prefix.length) ?? ""), init);
};

export const collect_presence_updates = (callback: (old_presence: Discord.Presence | null, new_presence: Discord.Presence) => void) => {
    presence_collectors.push({ callback });
};

export const on_client_available = (callback: (client: Discord.Client) => void) => {
    client_collectors.push({ callback });
};

export const on_message = (message: MessageType): void => {
    message_collectors.map((v) => {
        if(!v.filter || v.filter(message)) v.callback(message);
    });
};

export const on_interaction = (interaction: Discord.Interaction<Discord.CacheType>): void => {
    if(!interaction.isCommand() && !interaction.isAutocomplete()) return;

    const com = commands.find(v => v.proto.name == interaction.commandName);

    if(com) {
        if(interaction.isCommand()) com.callback(interaction as CommandInteraction);
        if(interaction.isAutocomplete()) com.autocomplete?.(interaction as AutocompleteInteraction);
    }
    else {
        console.error("Didn't find command for", interaction.commandName);
    }
};

export const on_message_update = async (old_message: PartialMessageType, message: PartialMessageType): Promise<void> => {


    const norefetch = message.type != null && message.system != null && message.pinned != null && message.tts != null && message.content != null && message.cleanContent != null && message.author != null;
    const full_message = norefetch ? message : await message.fetch();
    if(!norefetch) {
        if(message.author?.id == message.client.user?.id)
            console.log("Refetched my message", message.type, message.system, message.pinned, message.tts, message.content, message.cleanContent, message.author);
        else
            console.log("Refetched", message);
    }
    message_update_collectors.map((v) => {
        if(!v.filter || v.filter(full_message, old_message)) v.callback(full_message, old_message);
    });
    message_collectors.map((v) => {
        if(v.trigger_on_message_update && (!v.filter || v.filter(full_message))) v.callback(full_message);
    });

};
export const on_message_delete = (message: PartialMessageType): void => {
    message_delete_collectors.map((v) => {
        if((!v.filter || v.filter(message))) v.callback(message);
    });
};

export const on_presence_update = (old_presence: Discord.Presence | null, new_presence: Discord.Presence) => {
    presence_collectors.map((v) => {
        v.callback(old_presence, new_presence);
    });
};

export const on_init = (client: Discord.Client): void => {
    message_collectors.map((v) => {
        v.init && v.init();
    });
    message_update_collectors.map((v) => {
        v.init && v.init();
    });
    client_collectors.map((v) => {
        v.callback(client);
    });

};

export const get_commands_json = () => {
    return commands.map(v => v.proto.toJSON());
};

export const get_most_recent_message = (messages: MessageManager, filter: (msg: MessageType) => boolean) => {
    let max = undefined as MessageType | undefined;
    messages.cache.map((message) => {
        if(max && max.createdTimestamp > message.createdTimestamp) return;
        if(!filter(message)) return;
        max = message;
    });
    return max;
};

export const get_nth_most_recent_message = (messages: MessageManager, n: number) => {
    return [...messages.cache.values()].sort((a, b) => a.createdTimestamp > b.createdTimestamp ? -1 : 1)?.[n];
};

export const get_all_messages_untill = async (channel: TextBasedChannel, should_stop: (msg: MessageType) => Promise<boolean> | boolean) => {
    let before = undefined as string | undefined;
    let finished = false;
    let i = 0;
    while(!finished) {
        const msgs = await channel.messages.fetch(before ? {
            limit: 100,
            before
        } : {
            limit: 100
        });

        for(const [id, msg] of msgs) {
            before = id;
            //  console.log(msg.content)
            if(await should_stop(msg)) {
                finished = true;
                break;
            }
        }
        if(i++ == 100) {
            console.error("get_all_messages_untill was never told to stopped!");
            break;
        }
    }
};

export const snowflake_to_timestamp = (time: string) => Number((BigInt(time) >> BigInt(22)) + BigInt(1420070400000));

export default {
    on_message, on_init, on_presence_update, on_message_delete, on_message_update, on_interaction, get_commands_json
};