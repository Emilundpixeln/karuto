import { RecognizeResult } from "./ocr_backend_shared.js"
import Tesseract, { createWorker, Worker } from 'tesseract.js';
import * as sharp from 'sharp';
let workers: Array<Worker> = [];
let ready_workers: Array<Worker> = [];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export let load_backend = async (worker_count: number) => {
    workers = [];
    ready_workers = [];
    for(let i = 0; i < worker_count; i++) {
        let worker = createWorker();
        await worker.load();
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
    
        let real_allowed = "6314Cicad#ompsRurkSn YevM'5JjAtH-W0NhgOTFwbKIyVlqGBzDPL=xöf78*:U./QE29Z&+()ü%–Xéá!,?×ôëâ[]²\"è~º;_³ÉíäðúóÓåç@ï°ÖòßñàÜµ{}êýÄû—½øìþ$";
        await worker.setParameters({
            tessedit_char_whitelist: real_allowed,
            tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK
        });
        workers.push(worker);
        ready_workers.push(worker);

    }
}

export let schedule = async (input: Buffer): Promise<RecognizeResult> => {
    while (ready_workers.length == 0) {
        await sleep(20);
    }
    let worker = ready_workers.pop();
    let result = await worker.recognize(input);
    ready_workers.push(worker);
    return result;
}

export let prepare = async (image: sharp.Sharp): Promise<Buffer> => {
    return image.toBuffer();
}