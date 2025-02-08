import { TextBasedChannel } from "discord.js";
import { collect_by_prefix_and_filter, on_client_available } from "./collector.js";

enum Status {
    DOWN = "Down",
    GOOD = "Good",
    BUSY = "Busy",
    FULL = "Full",
    MAINTENANCE = "Maintenance",
}

const get_status = async () => {
    const res = await fetch("https://www.playlostark.com/en-us/support/server-status");
    const text = await res.text();

    const regex = /server-status--(\w+)">(?:\n.+?)+?server-name">\n\s+Asta/g;
    const match = regex.exec(text);
    if(!match) return Status.DOWN;
    const lookup = {
        "good": Status.GOOD,
        "busy": Status.BUSY,
        "full": Status.FULL,
        "maintenance": Status.MAINTENANCE,
    };
    const key = match[1];
    if(key != "good" && key != "busy" && key != "full" && key != "maintenance") {
        console.log(`Unexpected ${match[1]}`);
        throw match[1];
    }
    return lookup[key];
};

let enabled = true;

on_client_available(async (c) => {
    return;
    const guild = await c.guilds.fetch("1100123024109346946");
    const channel = await guild.channels.fetch("1146485368535920650").catch(_ => null) as TextBasedChannel;
    if(!channel) return;
    let current_status = await get_status();
    let last_ping = 0;

    setInterval(async () => {
        if(!enabled) return;
        const new_status = await get_status();
        console.log(new_status);
        if(current_status == new_status) return;
        channel.send(`Asta Server changed from ${current_status} to ${new_status}`);

        if(new_status == Status.GOOD) {
            if(Date.now() - last_ping > 1000 * 60 * 60 * 24) {
                channel.send("Asta Server is online! <@&1146486386078265344>");
                last_ping = Date.now();
            } else {
                channel.send("Asta Server is online!");
            }
        }

        current_status = new_status;
    }, 30 * 1000).unref();
});

collect_by_prefix_and_filter("otoggle", (m) => m.channelId == "1146485368535920650", () => {
    enabled = !enabled;
});