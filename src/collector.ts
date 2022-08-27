import Discord, { Options } from "discord.js"

type MessageCollector = 
{
    filter: (message: MessageType) => boolean,
    callback: (message: MessageType) => void,
    init: () => void,
    trigger_on_message_update: boolean,
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
let message_delete_collectors: Array<MessageDeleteCollector> = [];
let presence_collectors: Array<PresenceCollector> = [];
let client_collectors: Array<ClientCollector> = [];


export type MessageType = Discord.Message<boolean> | Discord.PartialMessage;
export let collect = (callback: (message: MessageType) => void, options: { filter?: (message: MessageType) => boolean, init?: () => void, trigger_on_message_update?: boolean } = undefined): void => {
    message_collectors.push({ filter: options?.filter, callback, init: options?.init, trigger_on_message_update: options?.trigger_on_message_update ?? false });
}


export let hook_message_updates = (message: MessageType, callback: (message: MessageType) => void, timeout_ms: number = 60_000) => {
    let item = { filter: m => m.id == message.id, callback, init: undefined, trigger_on_message_update: true } as MessageCollector;
    message_collectors.push(item);
    setTimeout(() => message_collectors.filter((m) => m != item), timeout_ms);

    // call with initial state
    callback(message);
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

export let on_message_update = (message: MessageType): void => {

    message_collectors.map((v) => {
  
        if(v.trigger_on_message_update && (!v.filter || v.filter(message))) v.callback(message);
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
    client_collectors.map((v) => {
        v.callback(client)
    });

}


export default {
    on_message, on_init, on_presence_update, on_message_delete, on_message_update
};