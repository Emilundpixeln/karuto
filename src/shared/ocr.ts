import { spawn, ChildProcessWithoutNullStreams } from "child_process" 



export type OCR_Data = {series: string, char: string, raw_s: string, raw_c: string, confidence: number, wl: number, date: number };

let cur_resolve = undefined as (value: [OCR_Data[], string]) => void;
let cur_promise = undefined as Promise<OCR_Data[]>;

let cur_begin = undefined as number;

let child = undefined as ChildProcessWithoutNullStreams;


type A = Exclude<1 | 2, 2>
export let reload = () => {
    if(child) {
        child.stdout.removeAllListeners("data");
        child.kill();
    }

    child = spawn("C:\\dev\\cpp\\KarutoImgReg\\x64\\Release\\KarutoImgReg.exe", [ "-keepalive"]);
    child.stderr.on("data", (data: Buffer) => {
        let out = data.toString("utf-8");
        console.log("stderr\n", out);
    });
    child.stdout.on("data", (data: Buffer) => {
        let out = data.toString("utf-8");
        console.log(out);
        let res = out.split("\n").filter(s => s.length > 0 && s[0] != "[").slice(1).map(line => {
            let vals = line.split("\t");
            if(vals.length < 7) {
                console.error(`KarutoImgReg.exe error Stdout is ${out}`);
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
        if(!cur_resolve) 
        {
            console.error("cur_resolve undefined");
        }
        else
        {
            // if there are any line with errors just return undefined
            if(res.every(v => v != undefined) && res.length >= 3 && res.length <= 4) 
            {
                cur_resolve([res, out]);
            } else 
            {
                cur_resolve([undefined, out]);
            }
        }
        console.log(`OCR: Got stdout ${Date.now() - cur_begin}ms after write!`);
        cur_resolve = undefined;
    });
};
reload();

export let recognize = async (url: string, log_file: boolean): Promise<OCR_Data[]> => {
    if(cur_promise) await cur_promise;

    cur_promise = new Promise(resolve => {
        cur_resolve = (data_stdout: [OCR_Data[], string]) => 
        {
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