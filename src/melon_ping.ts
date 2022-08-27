import { collect } from './collector.js';




collect((msg) => {
    if(msg.author.id != "646937666251915264") return;
    if(msg.channelId != "932713994886721576") return;

    if(msg.content && (msg.content.endsWith("is dropping 3 cards!") || msg.content == "I'm dropping 3 cards since this server is currently active!")) {

        let collector = msg.createReactionCollector({ filter: (react, user) => "🍉".includes(react.emoji.name), time: 10 * 1000 });
        let karuta = false;
        let other = false;
        collector.on("collect", async (reaction, user)  => {
            if(user.id == "646937666251915264") karuta = true;
            if(user.id != "646937666251915264") other = true;
        });
        setTimeout(() => {
            if(karuta && !other) {
                msg.reply("🍉 Drop! <@&1007998487968886824>");
            }
        }, 10 * 1000);
    }
});