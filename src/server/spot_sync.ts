import { z } from "zod";
import { Trpc } from "./index.js";
import { WebSocketServer, WebSocket } from 'ws';


const wss_sender = new WebSocketServer({ port: 8081 });

let reciever = undefined as WebSocket | undefined;

let last_message = undefined as string | undefined;
wss_sender.on('connection', function connection(ws) {
    reciever = ws;
    console.log("CONNECTED to receiver");
    if(reciever != null && reciever.readyState === WebSocket.OPEN && last_message != undefined) {
        reciever.send(last_message);
    }

});

export const spot_sync = (t: Trpc) => t.procedure
    .input(z.object({
        track_id: z.string(),
        start: z.string(),
        end: z.string(),
        created_at: z.number(),
    }))
    .mutation(({ input }) => {
        console.log("api", input);
        last_message = JSON.stringify(input);
        if(reciever != null && reciever.readyState === WebSocket.OPEN) {
            reciever.send(last_message);
        }
    })
