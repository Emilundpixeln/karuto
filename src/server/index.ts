import { inferAsyncReturnType, initTRPC } from '@trpc/server';
import * as trpcExpress from '@trpc/server/adapters/express';
import express from 'express'
import { search } from "./search.js" 
import { youtube_get_first_frame } from './image.js';
import { adminRouter } from './admin.js';
import { spot_sync } from './spot_sync.js';

const createContext = ({
    req,
    res,
  }: trpcExpress.CreateExpressContextOptions) => ({}); // no context
type Context = inferAsyncReturnType<typeof createContext>;
const trpc = initTRPC.context<Context>().create();
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

const app = express();
app.use(
    '/trpc',
    trpcExpress.createExpressMiddleware({
        router: appRouter,
        createContext,
    }),
);
console.log("Started server...");
app.listen(3000);