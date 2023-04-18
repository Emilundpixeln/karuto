import { collect_by_prefix } from "./collector.js";


collect_by_prefix("oage", (m, c) => {
    const link = /discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/g.exec(c);

    const to_date = (time: string) => Number(((BigInt(time) >> BigInt(22)) + BigInt(1420070400000)) / BigInt(1000));

    if(link) {
        m.reply(`Created at <t:${to_date(link[3])}> (Guild:<t:${to_date(link[1])}>, Channel:<t:${to_date(link[2])}>)`);

    }
    else {
        const id = /(\d+)/g.exec(c);

        if(id)
            m.reply(`Created at <t:${to_date(id[1])}>`);
    }
});