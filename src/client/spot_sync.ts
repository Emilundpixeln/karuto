import { collect_by_prefix, collect_presence_updates, on_client_available } from "./collector.js";
import { Presence } from "discord.js";
import { api } from "./client.js";

let follow_id = undefined as string | undefined;
on_client_available((client) => {
    collect_by_prefix("osync", (m, cont) => {
        const id = /(\d+)/g.exec(cont);
        follow_id = id ? id[1] : undefined;
        if(follow_id) {
            console.log(`following ${follow_id}`);
            if(!follow_id) return;
            const member = client.guilds.cache.get("830254135608737792")?.members.cache.get(follow_id);
            if(!member?.presence) return;
            on_presence_update(member.presence);
        }
        if(!follow_id) {
            console.log("stoped sync");
        }
    });
});



collect_presence_updates((_, presence) => on_presence_update(presence));
const on_presence_update = async (data: Presence) => {

    if(data.activities.length == 0 || data.user?.id != follow_id)
        return;
    const spotify_data = data.activities.find((e) => e.id == "spotify:1") as unknown as {
        syncId: string,
        timestamps: {
            start: string,
            end: string
        },
        createdTimestamp: number
    };

    if(!spotify_data) {
        console.log("Not playing");
    }

    if(spotify_data == null || spotify_data.syncId == null)
        return;
    const track_id = spotify_data.syncId;
    const time = new Date().getTime();
    const created_at = (spotify_data.createdTimestamp - time) / 1000;
    console.log("sync", track_id);

    api.spot_sync.mutate({
        track_id,
        start: spotify_data.timestamps.start,
        end: spotify_data.timestamps.end,
        created_at
    });
};




