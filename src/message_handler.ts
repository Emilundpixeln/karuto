import { Message, MessageEditOptions, MessagePayload, TextBasedChannel, MessageComponentInteraction, CacheType, CommandInteraction } from "discord.js"
import { MessageType } from "./collector.js"


export class MessageHandler
{
    message: Promise<Message>;
    interaction: MessageComponentInteraction<CacheType>;
    interaction_command: CommandInteraction;
    message_send_via_interaction: boolean;

    constructor(interaction_command: CommandInteraction = undefined) {
        this.message = undefined;
        this.interaction = undefined;
        this.interaction_command = interaction_command;
        this.message_send_via_interaction = false;
    }

    send(channel: TextBasedChannel, content: string | Omit<MessageEditOptions, "flags"> | MessagePayload) {
        return this.send_impl(content, () => channel.send(content));
    }

    edit(content: string | Omit<MessageEditOptions, "flags"> | MessagePayload) {
        return this.send_impl(content, () => {
            console.error("MessageHandler edit, no Message was send!");
            return undefined;
        });
    }

    
    reply_to_given_interaction(content: string | Omit<MessageEditOptions, "flags"> | MessagePayload) {
        return this.send_impl(content, () => {
            console.error("MessageHandler reply_to_given_interaction, no interaction_command!");
            return undefined;
        });
    }

    reply(message: MessageType, content: string | Omit<MessageEditOptions, "flags"> | MessagePayload) {
        return this.send_impl(content, () => message.reply(content));
    }

    defer_on_edit(interaction: MessageComponentInteraction<CacheType>) {
        this.interaction = interaction;
    }

    private send_impl(content: string | Omit<MessageEditOptions, "flags"> | MessagePayload, sender: () => Promise<Message<boolean>>) {
        if(this.message) {
            try {
                this.message.then(m => this.interaction_command ? this.interaction_command.editReply(content) : m.edit(content)).then(_ => {
                    this.interaction && !this.interaction.deferred && this.interaction.deferUpdate();
                    this.interaction = undefined;
                });
            } catch (error) {}
        } else {
            if(this.interaction_command) {
                this.message = this.interaction_command.reply(content).then(_ => this.interaction_command.fetchReply() as Promise<Message<boolean>>);
                this.message_send_via_interaction = true;
            }
            else
                this.message = sender();
        }
        return this.message;
    }
}
