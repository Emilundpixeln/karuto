import { spawn, ChildProcessWithoutNullStreams } from "child_process"

import { existsSync } from "fs"




export type OCR_Data = { series: string, char: string, raw_s: string, raw_c: string, confidence: number, wl: number, date: number };

let cur_resolve = undefined as undefined | ((value: [OCR_Data[] | undefined, string]) => void);
let cur_promise = undefined as undefined | Promise<OCR_Data[] | undefined>;

let cur_begin = undefined as undefined | number;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
let child = undefined as undefined | ChildProcessWithoutNullStreams;
let current_stdout = "";

export let reload = async () => {
    current_stdout = "";
    if(child) {
        child.stdout.removeAllListeners("data");
        child.kill();
    }
    let path = process.env.KARUTO_IMG_REC_PATH;
    if(!path || !existsSync(path)) {
        console.log(`No Ocr available. Searched at ${path}`, process.env, process.env.KARUTO_IMG_REC_PATH);
        return;
    }
    console.log("Ocr available");
    child = spawn(path, ["-keepalive"]);
    child.stderr.on("data", (data: Buffer) => {
        let out = data.toString("utf-8");
        console.log("stderr\n", out);
    });

    child.stdout.on("data", (data: Buffer) => {
        current_stdout += data.toString("utf-8").replaceAll("\r", "");

        if(!current_stdout.includes("\nEOF\n")) {
            return;
        }
        // console.log("buff have EOF!", "Buf ---\n", buff, "\n---");

        let res = current_stdout.split("\n").filter(s => s.length > 0 && s[0] != "[" && s != "EOF").slice(1).map(line => {
            let vals = line.split("\t");
            if(vals.length < 7) {
                console.error(`KarutoImgReg.exe error Stdout is ${current_stdout}`);
                return undefined;
            }
            return {
                char: vals[0],
                series: vals[1],
                wl: parseInt(vals[2]),
                date: parseInt(vals[3]),
                confidence: parseFloat(vals[4]),
                raw_c: vals[5],
                raw_s: vals[6],
            }
        });
        //  console.log(res);
        if(!cur_resolve) {
            console.error("cur_resolve undefined. Tried to resolve with", res);
        }
        else {
            console.log("Resolving with", res, "Buf ---\n", current_stdout, "\n---");
            // if there are any line with errors just return undefined
            if(res.every(Boolean) && res.length >= 3 && res.length <= 4) {
                // see every check above
                cur_resolve([res as NonNullable<typeof res[number]>[], current_stdout]);
            } else {
                cur_resolve([undefined, current_stdout]);
            }
            cur_resolve = undefined;
            console.log(`OCR: Got stdout ${Date.now() - (cur_begin ?? 0)}ms after write!`);
        }
        current_stdout = "";
    });
};
reload();

export let recognize = async (url: string, log_file: boolean) => {
    if(cur_promise) await cur_promise;
    if(!child) return undefined;
    // return undefined on whitespace input
    if(url == "" || /^\s+$/.exec(url)) return undefined;

    cur_promise = new Promise<OCR_Data[] | undefined>(resolve => {
        let resolved = false;
        let timeout = setTimeout(async () => {
            if(resolved) return;
            console.error(`OCR timeout on ${url}. Stdout was ---\n${current_stdout}\n---`);

            await reload();

            cur_resolve = undefined;
            resolve(undefined);
        }, 5000);
        cur_resolve = (data_stdout) => {
            clearTimeout(timeout);
            resolve(data_stdout[0]);
            if(log_file) {
                console.log(`OCR stdout was: \n${data_stdout[1]}\n------`);
            }
        }

    });

    child.stdin.cork();
    child.stdin.write(`${url}\n`);
    child.stdin.uncork();

    cur_begin = Date.now();
    return cur_promise;
};