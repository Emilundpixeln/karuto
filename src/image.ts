import { Client, MessageAttachment, User } from "discord.js";
import { collect_by_prefix, register_command, SlashCommand } from "./collector.js";
import { spawn } from "child_process"
import { MessageHandler } from "./message_handler.js";
import { unlink, writeFile } from "fs/promises"
import { api } from "./client.js";

let url_is_ok = async (url: string) => fetch(url, {
    method: "HEAD"
}).then(responce => responce.status == 200);

let or_empty = (prefix: string, text: string | null, template = "~", say_none = true) => text ? `${prefix} ${template.replaceAll("~", text)}` : say_none ? `${prefix} None` : ""
let spawnP = (cmd: string, args: string[]) => {
    return new Promise<{ stdout: string, stderr: string }>((resolve, reject) => {
        let stdout = [] as string[]
        let stderr = [] as string[]
        const child = spawn(cmd, args)

        child.on('error', err => reject())
        child.stdout.on('error', err => reject())
        child.stderr.on('error', err => reject())
        child.stdout.on('data', data => stdout.push(data))
        child.stderr.on('data', data => stderr.push(data))
        child.on('close', code => {
            let stdout_s = stdout.join('').trim()
            let stderr_s = stderr.join('').trim()

            if(code === 0) {
                return resolve({ stdout: stdout_s, stderr: stderr_s })
            }
            return reject()
        })
    })
}

let process_yt_url = async (client: Client, url: string) => {
    let result = null as string | null
    let full_url = /youtube\.com\/(?:watch\?v=)|(?:shorts\/)([a-zA-Z0-9-_]+)/g.exec(url)
    if(full_url) result = full_url[1]
    let short_url = /youtu\.be\/([a-zA-Z0-9-_])/g.exec(url)
    if(short_url) result = short_url[1]
    if(!result) return null;

    let thumbnail = `Thumbnail:\nhttps://i.ytimg.com/vi/${result}/hqdefault.jpg`;
    let api_result = await api.youtube_get_first_frame.query({ yt_id: result }).catch(_ => null);
    if(!api_result) return thumbnail;

    return {
        text: `1st Frame:\n${thumbnail}`,
        attachment: Buffer.from(api_result.base64, "base64")
    }

}

let process_pinterest_url = async (client: Client, url: string) => {
    let url_regex = /(?:^|\.|\/\/)pinterest\.[^/]+\/pin\/(\d+)/g;
    let image_regex = /<link rel="preload" fetchpriority="high" nonce="[0-9a-f]+" href="https:\/\/i\.pinimg\.com\/[^/]+\/([0-9a-f]+\/[0-9a-f]+\/[0-9a-f]+\/[0-9a-f]+\.[^"]+)" as="image"\/>/g;

    let url_match = url_regex.exec(url)
    if(!url_match) return null;
    let pin_url = `https://www.pinterest.com/pin/${url_match[1]}/`;
    let html = await (await fetch(pin_url)).text();
    let image_match = image_regex.exec(html)
    if(!image_match) return null;

    return `https://i.pinimg.com/originals/${image_match[1]}`;
}


let process_opgg_url = async (client: Client, url: string) => {
    let url_regex = /(?:^|\.|\/\/)op\.gg\/summoners\/([^\/]+\/[^\/]+)/g;
    let image_regex = /<img src=\"(https:\/\/opgg-static\.akamaized\.net\/images\/profile_icons\/[^\"]+)\" alt=\"profile image\"\/>/g;

    let url_match = url_regex.exec(url)
    if(!url_match) return null;
    let pin_url = `https://www.op.gg/summoners/${url_match[1]}`;
    let html = await (await fetch(pin_url)).text();
    let image_match = image_regex.exec(html)
    if(!image_match) return null;

    return image_match[1]
}
let process_ugg_url = async (client: Client, url: string) => {
    let url_regex = /(?:^|\.|\/\/)u\.gg\/lol\/profile\/([^\/]+\/[^\/]+)/g;
    let image_regex = /<img class=\"profile-icon-image\" src=\"(https:\/\/static\.bigbrain\.gg\/assets\/[^\"]+)\"\/>/g;

    let url_match = url_regex.exec(url)
    if(!url_match) return null;
    let pin_url = `https://u.gg/lol/profile/${url_match[1]}/overview`;
    let html = await (await fetch(pin_url)).text();


    let image_match = image_regex.exec(html)
    if(!image_match) return null;

    return image_match[1]
}

let process_discord_invite = async (client: Client, url: string) => {
    let url_regex = /(?:^|\.|\/\/)discord\.(?:gg\/([^/]+))|(?:com\/invite\/([^/]+))/g;

    let url_match = url_regex.exec(url)
    if(!url_match) return null;
    let pin_url = `https://discord.com/api/v9/invites/${url_match[1] ?? url_match[2]}`;
    let responce = await fetch(pin_url);
    if(responce.status != 200) return null;
    let json = await responce.json() as {
        guild: {
            id: string,
            name: string,
            splash: string | null,
            banner: string | null,
            description: string | null,
            icon: string | null,
        }
    };
    let id = json.guild.id;

    return `Discord Guild ${json.guild.name} (${json.guild.id})`
        + or_empty("\nBanner:", json.guild.banner, `https://cdn.discordapp.com/banners/${id}/~.jpg?size=1024`)
        + or_empty("\nSplash:", json.guild.splash, `https://cdn.discordapp.com/splashes/${id}/~.jpg?size=3072`)
        + or_empty("\nIcon:", json.guild.icon, `https://cdn.discordapp.com/icons/${id}/~.webp?size=512`)
}

let process_user_id = async (client: Client, url: string) => {

    let user_id = /^(\d{14,})$/g.exec(url)

    if(!user_id) return null;

    let user = await client.users.fetch(user_id[1]).catch(() => null);
    if(!user) return null;
    return await process_user(user);
}

let process_user = async (user: User) => {
    await user.fetch()
    console.log(user)

    let banner = user.bannerURL({
        format: "gif",
        size: 4096
    });
    let avatar = user.avatarURL({
        format: "gif",
        size: 4096
    })
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
}

register_command(new SlashCommand()
    .setName("get_images")
    .addStringOption(opt => opt.setName("url").setDescription("A YouTube Url or User ID"))
    .addUserOption(opt => opt.setName("user").setDescription("Lookup images from a profile instead"))
    .setDMPermission(true)
    .setDescription("Get images from a thumbnail or profile"), async i => {
        let url = i.options.getString("url");
        let user = i.options.getUser("user")
        if(!url && !user) {
            return i.reply("Provide a url or a user!");
        }
        if(!!url) {


            const handler = [
                process_yt_url,
                process_user_id,
                process_pinterest_url,
                process_discord_invite,
                process_opgg_url,
                process_ugg_url
            ];
            const promises = handler.map(async h => {
                let result = await h(i.client, url!);
                if(typeof result == "string")
                    return {
                        text: result,
                        attachment: null as string | null
                    }
                return result;
            });
            let msg = MessageHandler.as_interaction_command_reply(i)
            // TODO doen't send if fast enough
            msg.send("Thinking...");

            const results = (await Promise.all(promises)).filter(Boolean);
            console.log("results", results)
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
            let res = await process_user(user);
            i.reply(res);
        }
    });



let do_ris = async (m: MessageHandler, url: string) => {

    let res = await fetch("https://lens.google.com/uploadbyurl?" + new URLSearchParams({
        url
    })).catch(_ => null);

    if(!res)
        return m.send("Something went wrong. (Post failed)");

    m.send(res.url);
}

collect_by_prefix("oris", (m, cont) => {
    do_ris(MessageHandler.as_message_reply(m), cont);
})


register_command(new SlashCommand()
    .setName("reverse_image_search").setDescription("Open Google reverse image search.")
    .addStringOption(opt => opt.setName("url").setDescription("Link to an image")),
    async i => {
        let url = i.options.getString("url", true);
        do_ris(MessageHandler.as_interaction_command_reply(i), url);
    });