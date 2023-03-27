import { z } from "zod";
import { Trpc } from "./index.js";
import { spawn } from "child_process"
import { unlink, readFile } from "fs/promises"



let spawnP = (cmd: string, args: string[]) => {
    return new Promise<{ stdout: string, stderr: string }>((resolve, reject) => {
        let stdout = [] as string[]
        let stderr = [] as string[]
        const child = spawn(cmd, args)

        child.on('error', err => reject())
        child.stdout.on('error', err => reject())
        child.stderr.on('error', err => reject())
        child.stdout.on('data', data => stdout.push(data))
        child.stderr.on('data', data => stderr.push(data))
        child.on('close', code => {
            let stdout_s = stdout.join('').trim()
            let stderr_s = stderr.join('').trim()

            if(code === 0) {
                return resolve({ stdout: stdout_s, stderr: stderr_s })
            }
            return reject()
        })
    })
}

export const youtube_get_first_frame = (t: Trpc) => t.procedure
    .input(z.object({ yt_id: z.string().length(11) }))
    .query(async req => {
        let { yt_id } = req.input;
        console.log("youtube_get_first_frame", req.input);

        let yt_dl = await spawnP("yt-dlp", ["--youtube-skip-dash-manifest", "-g", `https://www.youtube.com/watch?v=${yt_id}`])
        console.log(yt_dl)
        let [vid_url, audio_url] = yt_dl.stdout.split("\n")

        let file_name = `tmp/${Math.random().toString().slice(2)}.png`;

        let ffmpeg = await spawnP("ffmpeg", ["-i", vid_url, "-vframes", "1", "-q:v", "2", file_name]).catch(_ => null);
        console.log(ffmpeg)
        let base64 = (await readFile(file_name)).toString("base64")
        unlink(file_name);
        return {
            base64
        }
    });