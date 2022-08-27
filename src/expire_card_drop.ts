import {collect} from './collector.js';

let to_date = (time: string) => Number(((BigInt(time) >> BigInt(22)) + BigInt(1420070400000)) / BigInt(1000));

collect((msg) => {
    if(msg.author.id != "646937666251915264") return;
    if(msg.channelId != "932713994886721576") return;

    if(msg.content && (msg.content.endsWith("is dropping 3 cards!") || msg.content == "I'm dropping 3 cards since this server is currently active!")) {
        let my_message = msg.reply(`Expires <t:${to_date(msg.id) + 60}:R>`);

        setTimeout(async () => {
            if(my_message != undefined) {
                (await my_message).delete();
                my_message = undefined;
            }
        }, 60 * 1000);
        let collector = msg.createReactionCollector({ filter: (react, user) => "1️⃣2️⃣3️⃣".includes(react.emoji.name) && user.id != "646937666251915264", time: 60 * 1000, max: 4, maxEmojis: 3});
        collector.on("collect", async (reac, user) => {
            if(my_message != undefined) {
                (await my_message).delete();
                my_message = undefined;
                collector.stop();
            }
        });
    }
});