import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from './server/index.js';

const endpoint = `http://${process.env.API_ENDPOINT ?? "localhost"}:3000/trpc`;
export const api = createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: endpoint,
      }),
    ]
  }
);

type Api = typeof api;

let api_connection_listeners = [] as ((api: Api) => void)[];
export const on_api_connect = (callback: (api: Api) => void) => {
    api_connection_listeners.push(callback);
}

export const api_unavailable_error_message = "Service unavailable.";

let last_started_at = 0;
let last_check_succeeded = false;

let check_for_api_avaiabilty = async () => {
    let resp = await api.ping.query().catch(_ => null);
    if(resp == null) {
        if(last_check_succeeded) console.log("Api Disconnected!");
        last_check_succeeded = false;
        return;
    }
    last_check_succeeded = true;
    if(last_started_at < resp.started_at) {
        console.log(`Api ${last_started_at == 0 ? "Connected" : "Reconnected"}!`);
        last_started_at = resp.started_at;

        api_connection_listeners.forEach(listener => listener(api));
    }
};

export let api_available = () => last_check_succeeded;

check_for_api_avaiabilty();
setInterval(check_for_api_avaiabilty, 30_000).unref();