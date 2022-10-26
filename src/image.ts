import { collect_by_prefix, MessageType, register_command, SlashCommand } from "./collector.js";
import { rmSync } from 'fs';
import { readdir } from 'fs/promises';

import { execFile } from "child_process" 
import { promisify } from "util" 

const execFileP = promisify(execFile);
let globalPromise = undefined;
let enabled = false;

collect_by_prefix("osd", (msg, cont) => {
    if(msg.author.id != "261587350121873408") return;
    if(cont.trim() == "enable") {
        enabled = true;
        msg.reply("Stable diffision is now \`enabled\`");
        return;
    }
    else if(cont.trim() == "disable") {
        enabled = false;
        msg.reply("Stable diffision is now \`disabled\`");
        return;
    }
    else {
        msg.reply(`Stable diffision is \`${enabled ? "enabled" : "disabled"}\``);
    }
});

register_command(new SlashCommand().setName("image").setDescription("Generate an image from a prompt")
    .addStringOption(op => op.setDescription("Prompt").setName("prompt").setRequired(true).setMinLength(3).setMaxLength(100))
    .addIntegerOption(op => op.setDescription("Quality (Better takes longer). Default:25").setName("quality").setRequired(false).setMinValue(1).setMaxValue(80)), async (i) => {
    if(!enabled && i.member.user.id != "261587350121873408") {
        i.reply({ content: "Currently disabled", ephemeral: true });
        return;
    }
    let prompt = i.options.getString("prompt");
    let qual = i.options.getInteger("quality") ?? 25;
    if(globalPromise != undefined) {
        i.reply({ content: "Already generating an image, please wait", ephemeral: true });
        return;
    }
    let my_message = i.reply({ content: `Generating for prompt: \`${prompt}\` Finished <t:${Math.floor(Date.now() / 1000 + 80 * qual / 25)}:R>`, fetchReply: true }) as Promise<MessageType>;
    let start = Date.now();
    console.log(`Generating for \`${prompt}\` at quality ${qual}`);
    globalPromise = execFileP("cmd.exe", ["/c", "stable_diffision.bat", prompt, qual.toString()]).then(async (value: { stdout: string, stderr: string }) => {
            console.log("Finished generation");
            let dirs = (await readdir("stable_diffision/stable-diffusion/out", { withFileTypes: true })).filter(dirent => dirent.isDirectory());

            if(dirs.length != 1) {
                console.log("multiple dirs");
                console.log(dirs);
                (await my_message).edit("Something went wrong...");
                globalPromise = undefined;
                return
            }


            await (await my_message).edit({ content: `Images for \`${prompt}\` Took ${((Date.now() - start) / 1000).toFixed(0)}s`,
                files: (await readdir(`stable_diffision/stable-diffusion/out/${dirs[0].name}`)).map((v, i) => ({
                    attachment: `stable_diffision/stable-diffusion/out/${dirs[0].name}/${v}`
                })) 
            });
            rmSync(`stable_diffision/stable-diffusion/out/${dirs[0].name}`, { recursive: true, force: true });
            globalPromise = undefined;
    })
});