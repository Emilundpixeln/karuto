import { z } from "zod";
import { Trpc } from "./index.js";
import { readFile, writeFile } from "fs/promises"
import { wl_data_path, wl_data_too_new } from "../shared/klu_data.js";


export const adminRouter = (t: Trpc) => t.router({
    add_to_series_file: t.procedure
        .input(z.object({
            to_add: z.array(z.string())
        }))
        .mutation(async req => {
            let { to_add } = req.input;

            let file_name = "../karuta-indexer/data/series_data.json";
            let serieses = JSON.parse(await readFile(file_name, { encoding: "utf-8" })) as string[];

            let real_added = to_add.filter(ser => {
                if(serieses.indexOf(ser) != -1) {
                    return false;
                }
                serieses.push(ser);
                return true;
            });
            await writeFile(file_name, JSON.stringify(serieses));
            return real_added;
        }),
    add_to_chars_file: t.procedure
        .input(z.object({
            to_add: z.array(z.object({
                series: z.string(),
                char: z.string()
            }))
        }))
        .mutation(async req => {
            let { to_add } = req.input;
            let wl_data = JSON.parse(await readFile(wl_data_path, { encoding: "utf-8" })) as { [series: string]: { [character: string]: { wl: number, date: number } } };
            let real_added = to_add.filter(({ series, char }) => {
                if(!wl_data[series]) {
                    wl_data[series] = {}
                }
                if(wl_data[series][char]) return false;
                wl_data[series][char] = {
                    date: Date.now(),
                    wl: wl_data_too_new
                }
                return true;
            });
            await writeFile(wl_data_path, JSON.stringify(wl_data));
            return real_added;
        })
});
