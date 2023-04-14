import { readFileSync, existsSync } from "fs";

const config = existsSync("config.json") ? JSON.parse(readFileSync("config.json", { encoding: "utf-8" })) : {};

const get_or_default = <T>(str: string, default_value: T): T => {
    return config[str] != undefined ? config[str] : default_value;
};


export const BOT_TOKEN = get_or_default("BOT_TOKEN", "");