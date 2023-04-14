import { readFileSync } from "fs";
import fetch from "node-fetch-commonjs";

const token = JSON.parse(readFileSync("token.json", { encoding: "utf-8" })).token;

const get_messages = async (user_id: string, guild_id: string) => {

    const times = [];

    while(times.length < 1000) {

        const res = await fetch(`https://discord.com/api/v9/guilds/${guild_id}/messages/search?author_id=${user_id}&offset=${times.length + 20}`, {
            "headers": {
                "accept": "*/*",
                "accept-language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
                "authorization": token,
                "cache-control": "no-cache",
                "pragma": "no-cache",
                "sec-ch-ua": "\"Google Chrome\";v=\"105\", \"Not)A;Brand\";v=\"8\", \"Chromium\";v=\"105\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "\"Windows\"",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "x-debug-options": "bugReporterEnabled",
            },
            "body": null,
            "method": "GET"
        });


        const json = await res.json() as {
            total_results: number,
            messages: Array<[{
                id: string,
                channel_id: string
            }]>
        };

        if(!json.messages)
            break;
        console.log(json);
        const to_date = (time: string) => Number(((BigInt(time) >> BigInt(22)) + BigInt(1420070400000)) / BigInt(1000));
        times.push(...json.messages.map(val => {
            const hour = Math.floor(to_date(val[0].id) / 60 / 60) % 24;

            return hour;
        }));
    }
    console.log(times);
    const hours = new Array(24).fill(0);
    times.map(h => hours[h] += 1);
    console.log(hours);
};

get_messages("626805934655799297", "696070301842276353");