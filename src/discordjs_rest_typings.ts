import { CDN, RequestManager, RESTOptions, REST, RouteLike, RequestData, InternalRequest } from '@discordjs/rest';
import { Routes as Routes_ } from 'discord-api-types/v9';
import { HexColorString, Snowflake, User } from 'discord.js';
import Dispatcher from 'undici/types/dispatcher';

export type RoutesTypings = {
    user: Pick<User, "id" | "username" | "avatar" | "discriminator" | "banner"> & {
        display_name: string | null,
        avatar_decoration: null, // TODO
        public_flags: number,
        banner_color: HexColorString | null,
        accent_color: number | null,
    },
    guildMessageSearch: {
        total_results: number,
        messages: [{
            id: string,
            channel_id: string
        }][]
    }


};

export const Routes = {
    ...Routes_,
    guildMessageSearch: (guild_id: Snowflake) => `/guilds/${guild_id}/messages/search` as const,
};

export type typed_REST = {
    get<T extends keyof (RoutesTypings)>(fullRoute: ReturnType<typeof Routes[T]>, options?: RequestData): Promise<RoutesTypings[T]>;

    readonly cdn: CDN;
    readonly requestManager: RequestManager;

    getAgent(): Dispatcher | null;

    setAgent(agent: Dispatcher): typed_REST;

    setToken(token: string): typed_REST;

    get(fullRoute: RouteLike, options?: RequestData): Promise<unknown>;


    delete(fullRoute: RouteLike, options?: RequestData): Promise<unknown>;

    post(fullRoute: RouteLike, options?: RequestData): Promise<unknown>;

    put(fullRoute: RouteLike, options?: RequestData): Promise<unknown>;

    patch(fullRoute: RouteLike, options?: RequestData): Promise<unknown>;

    request(options: InternalRequest): Promise<unknown>;

    raw(options: InternalRequest): Promise<Dispatcher.ResponseData>;
}

