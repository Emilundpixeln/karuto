import { z } from "zod";
import { Trpc } from "./index.js";
import { spawn } from "child_process";
import { unlink, readFile } from "fs/promises";



const spawnP = (cmd: string, args: string[]) => {
    return new Promise<{ stdout: string, stderr: string }>((resolve, reject) => {
        const stdout = [] as string[];
        const stderr = [] as string[];
        const child = spawn(cmd, args);

        child.on("error", _ => reject());
        child.stdout.on("error", _ => reject());
        child.stderr.on("error", _ => reject());
        child.stdout.on("data", data => stdout.push(data));
        child.stderr.on("data", data => stderr.push(data));
        child.on("close", code => {
            const stdout_s = stdout.join("").trim();
            const stderr_s = stderr.join("").trim();

            if(code === 0) {
                return resolve({ stdout: stdout_s, stderr: stderr_s });
            }
            return reject();
        });
    });
};

export const youtube_get_first_frame = (t: Trpc) => t.procedure
    .input(z.object({ yt_id: z.string().length(11) }))
    .query(async req => {
        const { yt_id } = req.input;
        console.log("youtube_get_first_frame", req.input);

        const yt_dl = await spawnP("yt-dlp", ["--youtube-skip-dash-manifest", "-g", `https://www.youtube.com/watch?v=${yt_id}`]);
        console.log(yt_dl);
        const [vid_url, _audio_url] = yt_dl.stdout.split("\n");

        const file_name = `tmp/${Math.random().toString().slice(2)}.png`;

        const ffmpeg = await spawnP("ffmpeg", ["-i", vid_url, "-vframes", "1", "-q:v", "2", file_name]).catch(_ => null);
        console.log(ffmpeg);
        const base64 = (await readFile(file_name)).toString("base64");
        unlink(file_name);
        return {
            base64
        };
    });