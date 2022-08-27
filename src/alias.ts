import { collect } from "./collector.js"
import { url_to_ident, klu_data } from "./shared/klu_data.js"

 
collect((m) => {
    if(m.author.id == "646937666251915264"
        && m.embeds.length > 0
        && (m.embeds[0].title == "Character Lookup" || m.embeds[0].title == "Character Results"))
    {
        m.react("🏷️");
        let collector = m.createReactionCollector({ filter: (react, user) => react.emoji.name == "🏷️" && user.id != m.client.user.id, time: 30 * 1000, max: 1, maxEmojis: 1});

        collector.on("collect", (r, u) => {
            let series = /Series · \*\*(.+)\*\*/g.exec(m.embeds[0].description);
            let char = /Character · \*\*(.+)\*\*/g.exec(m.embeds[0].description);
    
            if(!series || !char) return;
           
            let url = url_to_ident(klu_data[series[1]][char[1]]);
            let names = Object.entries(klu_data[series[1]]).filter((kv) => kv[1] && url_to_ident(kv[1] as string) == url).map((kv) => kv[0]);

            m.reply(`**Aliases**: ${names.map((s) => `\`${s}\``).join(", ")}`)
        });
    }
});
