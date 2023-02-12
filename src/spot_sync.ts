import { WebSocketServer, WebSocket } from 'ws';
import { collect_by_prefix, on_client_available } from './collector.js';
import { Presence } from "discord.js"

let follow_id = undefined;
let interval = undefined;
let client = undefined;
on_client_available((client) => {
    collect_by_prefix("osync", (m, cont) => {
        let id = /(\d+)/g.exec(cont);
        follow_id = id ? id[1] : undefined;
        if(follow_id && !interval) {
            console.log(`following ${follow_id}`);
            interval = interval ?? setInterval(() => {

                let member = client.guilds.cache.get("830254135608737792").members.cache.get(follow_id);

                on_presence_update(member.presence);
            }, 1000);
        }
        if(!follow_id) {
            console.log("stoped sync");
            clearInterval(interval);
        }
    });
});



const wss_sender = new WebSocketServer({ port: 8081 });



let reciever = null;

let last_message = null;
wss_sender.on('connection', function connection(ws) {
    reciever = ws;
    console.log("CONNECTED to receiver");
    if(reciever != null && reciever.readyState === WebSocket.OPEN && last_message != null) {
        reciever.send(last_message);
    }
 
});
let on_presence_update = async (data: Presence) => {

    data.member.avatarURL({})
    if(data.activities.length == 0 || data.user.id != follow_id)
        return;
    let spotify_data = data.activities.find((e) => e.id == "spotify:1") as unknown as {
        syncId: string,
        timestamps: {
            start: number,
            end: number
        },
        createdTimestamp: number
    };
    
    if(!spotify_data) {
        console.log("Not playing");
    } 

    if(spotify_data == null || spotify_data.syncId == null)
        return;
    let track_id = spotify_data.syncId;
    let time = new Date().getTime();
    let start = (spotify_data.timestamps.start - time) / 1000;
    let end = (spotify_data.timestamps.end - time) / 1000;
    let created_at = (spotify_data.createdTimestamp - time) / 1000;   
   /* console.log(track_id);
    console.log(start);
    console.log(end);
    console.log(created_at);*/

    last_message = JSON.stringify({
        track_id,
        start: spotify_data.timestamps.start,
        end: spotify_data.timestamps.end,
        created_at
    })
    if(reciever != null && reciever.readyState === WebSocket.OPEN) {
        reciever.send(last_message);
    }
}




