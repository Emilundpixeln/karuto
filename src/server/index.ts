import { initTRPC } from '@trpc/server';
import { createHTTPHandler } from '@trpc/server/adapters/standalone';
import { createServer } from 'http';
import { search } from "./search.js"
import { youtube_get_first_frame } from './image.js';
import { adminRouter } from './admin.js';
import { spot_sync } from './spot_sync.js';

const trpc = initTRPC.create();
export type Trpc = typeof trpc;


const uptime_begin = Date.now();

const appRouter = trpc.router({
    ping: trpc.procedure.query(res => ({
        started_at: uptime_begin
    })),
    search: search(trpc),
    youtube_get_first_frame: youtube_get_first_frame(trpc),
    admin: adminRouter(trpc),
    spot_sync: spot_sync(trpc)
});

export type AppRouter = typeof appRouter;


const handler = createHTTPHandler({
    router: appRouter,
    createContext() {
        return {};
    },
});
let server = createServer((req, res) => {
    handler(req, res);
});
console.log("Started server...");
server.listen(3000);