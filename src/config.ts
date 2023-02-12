import { readFileSync, existsSync } from "fs";

let config = existsSync("config.json") ? JSON.parse(readFileSync("config.json", { encoding: "utf-8"})) : {};

let get_or_default = <T>(str: string, default_value: T): T => {
    return config[str] != undefined ? config[str] : default_value;
}


export let use_cli_backend = get_or_default("use_cli_backend", false);
export let BOT_TOKEN = get_or_default("BOT_TOKEN", null) as string;