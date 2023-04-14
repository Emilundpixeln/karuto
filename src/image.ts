import { Client, User } from "discord.js";
import { collect_by_prefix, register_command, SlashCommand } from "./collector.js";
import { MessageHandler } from "./message_handler.js";
import { api } from "./client.js";

const url_is_ok = async (url: string) => fetch(url, {
    method: "HEAD"
}).then(responce => responce.status == 200);

const or_empty = (prefix: string, text: string | null, template = "~", say_none = true) => text ? `${prefix} ${template.replaceAll("~", text)}` : say_none ? `${prefix} None` : "";

const process_yt_url = async (client: Client, url: string) => {
    let result = null as string | null;
    const full_url = /youtube\.com\/(?:watch\?v=)|(?:shorts\/)([a-zA-Z0-9-_]+)/g.exec(url);
    if(full_url) result = full_url[1];
    const short_url = /youtu\.be\/([a-zA-Z0-9-_])/g.exec(url);
    if(short_url) result = short_url[1];
    if(!result) return null;

    const thumbnail = `Thumbnail:\nhttps://i.ytimg.com/vi/${result}/hqdefault.jpg`;
    const api_result = await api.youtube_get_first_frame.query({ yt_id: result }).catch(_ => null);
    if(!api_result) return thumbnail;

    return {
        text: `1st Frame:\n${thumbnail}`,
        attachment: Buffer.from(api_result.base64, "base64")
    };

};

const process_pinterest_url = async (client: Client, url: string) => {
    const url_regex = /(?:^|\.|\/\/)pinterest\.[^/]+\/pin\/(\d+)/g;
    const image_regex = /<link rel="preload" fetchpriority="high" nonce="[0-9a-f]+" href="https:\/\/i\.pinimg\.com\/[^/]+\/([0-9a-f]+\/[0-9a-f]+\/[0-9a-f]+\/[0-9a-f]+\.[^"]+)" as="image"\/>/g;

    const url_match = url_regex.exec(url);
    if(!url_match) return null;
    const pin_url = `https://www.pinterest.com/pin/${url_match[1]}/`;
    const html = await (await fetch(pin_url)).text();
    const image_match = image_regex.exec(html);
    if(!image_match) return null;

    return `https://i.pinimg.com/originals/${image_match[1]}`;
};


const process_opgg_url = async (client: Client, url: string) => {
    const url_regex = /(?:^|\.|\/\/)op\.gg\/summoners\/([^/]+\/[^/]+)/g;
    const image_regex = /<img src="(https:\/\/opgg-static\.akamaized\.net\/images\/profile_icons\/[^"]+)" alt="profile image"\/>/g;

    const url_match = url_regex.exec(url);
    if(!url_match) return null;
    const pin_url = `https://www.op.gg/summoners/${url_match[1]}`;
    const html = await (await fetch(pin_url)).text();
    const image_match = image_regex.exec(html);
    if(!image_match) return null;

    return image_match[1];
};
const process_ugg_url = async (client: Client, url: string) => {
    const url_regex = /(?:^|\.|\/\/)u\.gg\/lol\/profile\/([^/]+\/[^/]+)/g;
    const image_regex = /<img class="profile-icon-image" src="(https:\/\/static\.bigbrain\.gg\/assets\/[^"]+)"\/>/g;

    const url_match = url_regex.exec(url);
    if(!url_match) return null;
    const pin_url = `https://u.gg/lol/profile/${url_match[1]}/overview`;
    const html = await (await fetch(pin_url)).text();


    const image_match = image_regex.exec(html);
    if(!image_match) return null;

    return image_match[1];
};

const process_discord_invite = async (client: Client, url: string) => {
    const url_regex = /(?:^|\.|\/\/)discord\.(?:gg\/([^/]+))|(?:com\/invite\/([^/]+))/g;

    const url_match = url_regex.exec(url);
    if(!url_match) return null;
    const pin_url = `https://discord.com/api/v9/invites/${url_match[1] ?? url_match[2]}`;
    const responce = await fetch(pin_url);
    if(responce.status != 200) return null;
    const json = await responce.json() as {
        guild: {
            id: string,
            name: string,
            splash: string | null,
            banner: string | null,
            description: string | null,
            icon: string | null,
        }
    };
    const id = json.guild.id;

    return `Discord Guild ${json.guild.name} (${json.guild.id})`
        + or_empty("\nBanner:", json.guild.banner, `https://cdn.discordapp.com/banners/${id}/~.jpg?size=1024`)
        + or_empty("\nSplash:", json.guild.splash, `https://cdn.discordapp.com/splashes/${id}/~.jpg?size=3072`)
        + or_empty("\nIcon:", json.guild.icon, `https://cdn.discordapp.com/icons/${id}/~.webp?size=512`);
};

const process_user_id = async (client: Client, url: string) => {

    const user_id = /^(\d{14,})$/g.exec(url);

    if(!user_id) return null;

    const user = await client.users.fetch(user_id[1]).catch(() => null);
    if(!user) return null;
    return await process_user(user);
};

const process_user = async (user: User) => {
    await user.fetch();
    console.log(user);

    let banner = user.bannerURL({
        format: "gif",
        size: 4096
    });
    let avatar = user.avatarURL({
        format: "gif",
        size: 4096
    });
    // use webp if it's not a gif
    await Promise.all([
        banner && url_is_ok(banner).then(ok => !ok && (banner = user.bannerURL({
            format: "webp",
            size: 4096
        }))
        ),
        avatar && url_is_ok(avatar).then(ok => !ok && (avatar = user.avatarURL({
            format: "webp",
            size: 4096
        }))
        )
    ]);


    return `Avatar: ${avatar}${or_empty("\nBanner: ", banner)}`;
};

register_command(new SlashCommand()
    .setName("get_images")
    .addStringOption(opt => opt.setName("url").setDescription("A YouTube Url or User ID"))
    .addUserOption(opt => opt.setName("user").setDescription("Lookup images from a profile instead"))
    .setDMPermission(true)
    .setDescription("Get images from a thumbnail or profile"), async i => {
        const url = i.options.getString("url");
        const user = i.options.getUser("user");
        if(!url && !user) {
            return i.reply("Provide a url or a user!");
        }
        if(url) {


            const handler = [
                process_yt_url,
                process_user_id,
                process_pinterest_url,
                process_discord_invite,
                process_opgg_url,
                process_ugg_url
            ];
            const promises = handler.map(async h => {
                const result = await h(i.client, url);
                if(typeof result == "string")
                    return {
                        text: result,
                        attachment: null as string | null
                    };
                return result;
            });
            const msg = MessageHandler.as_interaction_command_reply(i);
            // TODO doen't send if fast enough
            msg.send("Thinking...");

            const results = (await Promise.all(promises)).filter(Boolean);
            console.log("results", results);
            if(results.length > 0) msg.send({
                content: results.map(v => v.text).join("\n"),
                files: results.map(v => v.attachment).filter(Boolean).map(v => ({
                    attachment: v,
                    name: "attachment.png"
                }))
            });
            else msg.send(`Could not find anything for ${url}.`);

        }

        if(user) {
            const res = await process_user(user);
            i.reply(res);
        }
    });



const do_ris = async (m: MessageHandler, url: string) => {

    const res = await fetch("https://lens.google.com/uploadbyurl?" + new URLSearchParams({
        url
    })).catch(() => null);

    if(!res)
        return m.send("Something went wrong. (Post failed)");

    m.send(res.url);
};

collect_by_prefix("oris", (m, cont) => {
    do_ris(MessageHandler.as_message_reply(m), cont);
});


register_command(new SlashCommand()
    .setName("reverse_image_search").setDescription("Open Google reverse image search.")
    .addStringOption(opt => opt.setName("url").setDescription("Link to an image")),
    async i => {
        const url = i.options.getString("url", true);
        do_ris(MessageHandler.as_interaction_command_reply(i), url);
    });