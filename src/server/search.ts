import { z } from "zod";
import { Trpc } from "./index.js";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileP = promisify(execFile);

export const search = (t: Trpc) => t.procedure
    .input(z.string())
    .query(async req => {
        const query = req.input;
        console.log(`search: ${query}`);
        const { stdout, stderr } = await execFileP("Search.exe", query.split(" "));

        if(stderr.length > 0) {
            console.log(`Error: ${stderr}`);

            return {
                error: stderr
            };
        }
        else {
            const lines = stdout.trim().split("\n").map(s => s.replaceAll("\r", "")).filter(l => !l.startsWith("["));


            const matches_inacc = lines[1].endsWith("+");
            const matches = Number(matches_inacc ? lines[1].substring(0, lines[1].length - 1) : lines[1]);
            const total_cards = Number(lines[0]);

            const cards = lines.slice(2).map((line) => {
                const parts = line.split("\t");
                console.log(parts);
                return {
                    print: Number(parts[0]),
                    wl: Number(parts[1]),
                    card_id: parts[2],
                    name: parts[3],
                    series: parts[4],
                    edition: Number(parts[5]),
                    owner: parts[6].trimEnd(),
                };

            });

            console.log(cards.slice(0, 10));
            return {
                cards,
                matches,
                total_cards,
                matches_inacc
            };
        }
    });



