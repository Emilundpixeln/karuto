import { Message, MessageEditOptions, MessagePayload, TextBasedChannel, MessageComponentInteraction, CacheType } from "discord.js"
import { MessageType } from "./collector.js"

export class MessageHandler
{
    message: Promise<Message>;
    interaction: MessageComponentInteraction<CacheType>;

    constructor() {
        this.message = undefined;
        this.interaction = undefined;
    }

    send(channel: TextBasedChannel, content: string | MessageEditOptions | MessagePayload) {
        if(this.message) {
            try {
                this.message.then(m => m.edit(content)).then(_ => {
                    this.interaction && this.interaction.deferUpdate();
                    this.interaction = undefined;
                });
            } catch (error) {}
        } else {
            this.message = channel.send(content);
        }
    }

    reply(message: MessageType, content: string | MessageEditOptions | MessagePayload) {
        if(this.message) {
            try {
                this.message.then(m => m.edit(content)).then(_ => {
                    this.interaction && this.interaction.deferUpdate();
                    this.interaction = undefined;
                });
            } catch (error) {}
        } else {
            this.message = message.reply(content);
        }
    }

    /* reply through this interaction */
    defer_on_edit(interaction: MessageComponentInteraction<CacheType>) {
        this.interaction = interaction;
    }
}

export let make_message = (): MessageHandler => {
    return new MessageHandler();
}

