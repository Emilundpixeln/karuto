import { Message, MessageEditOptions, MessagePayload, TextBasedChannel, MessageComponentInteraction, CacheType, CommandInteraction, InteractionReplyOptions } from "discord.js";
import { as_message_or_throw, MessageType } from "./collector.js";

type Content = string | (Omit<MessageEditOptions, "flags" | "embeds"> & Pick<InteractionReplyOptions, "embeds">) | MessagePayload;

export class MessageHandler {
    message: Promise<Message> | undefined;
    interaction: MessageComponentInteraction<CacheType> | undefined;
    sender: (content: Content) => Promise<Message<boolean>>;

    private constructor(sender: (content: Content) => Promise<Message<boolean>>) {
        this.message = undefined;
        this.interaction = undefined;
        this.sender = sender;
    }

    static as_interaction_command_reply(interaction_command: CommandInteraction) {
        // maybe need to edit through interaction this.interaction_command.editReply(content)
        return new MessageHandler((content) => interaction_command.reply(content).then(() => as_message_or_throw(interaction_command.fetchReply())));
    }

    static as_channel_send(channel: TextBasedChannel) {
        return new MessageHandler((content) => channel.send(content));
    }

    static as_message_reply(message: MessageType) {
        return new MessageHandler((content) => message.reply(content));
    }

    send(content: Content) {
        if(typeof content == "object" && "embeds" in content && content.embeds == null) {
            content.embeds = undefined;
        }
        if(this.message) {
            try {
                console.log(this.message, content);
                this.message.then(m => m.edit(content)).then(_ => {
                    this.interaction && !this.interaction.deferred && this.interaction.deferUpdate();
                    this.interaction = undefined;
                });
            } catch(error) {
                console.error(error);
            }
        } else {
            this.message = this.sender(content);
        }
        return this.message;
    }

    defer_on_edit(interaction: MessageComponentInteraction<CacheType>) {
        this.interaction = interaction;
    }
}
