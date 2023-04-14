import { collect_by_prefix, get_nth_most_recent_message, register_command, SlashCommand } from "./collector.js";
import { MessageHandler } from "./message_handler.js";

const do_regex_replace = (m: MessageHandler, regex: string, template: string, source: string) => {
    try {

        const re = new RegExp(regex, "g");
        let str = source;

        template = template.replaceAll("\\t", "\t");
        template = template.replaceAll("\\n", "\n");
        const template_matches = [...template.matchAll(/&(\d+)/g)].reverse();
        [...source.matchAll(re)].reverse().forEach(match => {
            if(!match.index) return;
            let replacement = template;
            template_matches.forEach(group_match => {
                const group = match[Number(group_match[1])];
                if(!group || !group_match.index) return;
                replacement = replacement.slice(0, group_match.index) + group + replacement.slice(group_match.index + group_match[0].length);
            });
            str = str.slice(0, match.index) + replacement + str.slice(match.index + match[0].length);
        });

        m.send(str);
    } catch(error) {
        m.send(`${error}`);
    }
};

collect_by_prefix("oexre", async (m, cont) => {
    if(m.author.bot) return;
    if(!cont.includes("/")) return m.reply("Provide regex, template and optional message offset seperated by `/`");
    const [regex, template, offset] = cont.split("/");
    const offset_i = offset && !isNaN(Number(offset)) && Number(offset) > 0 ? Math.floor(Number(offset)) : 1;
    await m.channel.messages.fetch();
    const source = m.reference ? await m.fetchReference() : get_nth_most_recent_message(m.channel.messages, offset_i);
    do_regex_replace(MessageHandler.as_message_reply(m), regex.trimLeft(), template, source.content);
});

register_command(new SlashCommand().setDMPermission(true).setDescription("Replace all RegExp matches from message content with a template. Groups are mapped to &0, &1, ...")
    .setName("exre").addStringOption(i => i.setRequired(true).setName("regex").setDescription("The RegExp to use"))
    .addStringOption(i => i.setRequired(true).setName("template").setDescription("Text to replace the matched regions with. Use &0, &1, ... to refer to the groups of the match."))
    .addIntegerOption(i => i.setRequired(false).setMinValue(0).setName("offset").setDescription("The n-th to last message to use as the source. Default: 1 (Most recent message).")), async i => {

        if(!i.channel) return i.reply("Can't get channel!");
        await i.channel.messages.fetch();
        const source = get_nth_most_recent_message(i.channel.messages, (i.options.getInteger("offset") ?? 1) - 1);
        do_regex_replace(MessageHandler.as_interaction_command_reply(i), i.options.getString("regex", true), i.options.getString("template", true), source.content);
    });
collect_by_prefix("oexre", async (m, cont) => {
    if(m.author.bot) return;
    if(!cont.includes("/")) return m.reply("Provide regex, template and optional message offset seperated by `/`");
    const [regex, template, offset] = cont.split("/");
    const offset_i = offset && !isNaN(Number(offset)) && Number(offset) > 0 ? Math.floor(Number(offset)) : 1;
    await m.channel.messages.fetch();
    const source = m.reference ? await m.fetchReference() : get_nth_most_recent_message(m.channel.messages, offset_i);
    do_regex_replace(MessageHandler.as_message_reply(m), regex.trimLeft(), template, source.content);
});

