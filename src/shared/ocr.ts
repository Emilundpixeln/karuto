import ls from 'js-levenshtein';
import * as sharp from 'sharp';
import { series_strs, character_strs, wl_data } from './klu_data.js';
import fetch from 'node-fetch-commonjs';
import { Bbox, RecognizeResult, Word } from "./ocr_backend_shared.js"
import { use_cli_backend } from "./../config.js"

let load_backend: (worker_count: number) => Promise<void>;
let prepare: (image: sharp.Sharp) => Promise<Buffer | string>;
let schedule: (input: Buffer | string) => Promise<RecognizeResult>;
let load_module: Promise<void>;

if(use_cli_backend) {
    load_module = import("./cli_ocr_backend.js").then(M => {
        load_backend = M.load_backend;
        prepare = M.prepare;
        schedule = M.schedule;
    });
  
} else {
    load_module = import("./tesseract_js_backend.js").then(M => {
        load_backend = M.load_backend;
        prepare = M.prepare;
        schedule = M.schedule;
    });
}

let lefts = [
    55,
    330,
    603,
    878
].map(v => v - 1);
let width = 195 - 13 - 13 + 4;
let top_a = 63;
let top_b = 315;
let height = 42;
const rectangles = [
    {
        left: lefts[0],
        top: top_a,
        width: width,
        height: height,
    },
    {
        left: lefts[1],
        top: top_a,
        width: width,
        height: height,
    },
    {
        left: lefts[2],
        top: top_a,
        width: width,
        height: height,
    },
    {
        left: lefts[3],
        top: top_a,
        width: width,
        height: height,
    },
];

const rectanglesSeries = [
    {
      left: lefts[0],
      top: top_b,
      width: width,
      height: height,
    },
    {
      left: lefts[1],
      top: top_b,
      width: width,
      height: height,
    },
    {
      left: lefts[2],
      top: top_b,
      width: width,
      height: height,
    },
    {
      left: lefts[3],
      top: top_b,
      width: width,
      height: height,
    },
  ];



let sharp_rect = (box: Bbox, color: string) => {
    let svg = Buffer.from(`
        <svg width="${Math.max(box.x1 - box.x0, 1)}" height="${Math.max(box.y1 - box.y0, 1)}">
            <rect x="0" y="0" width="${Math.max(box.x1 - box.x0, 1)}" height="${Math.max(box.y1 - box.y0, 1)}" style="fill:rgb(0,0,0,0);stroke-width:1;stroke:${color}" />
        </svg>
    `);
    return {
        input: svg,
        top: box.y0,
        left: box.x0
    }
}




export type OCR_Data = {series: string, char: string, raw_s: string, raw_c: string,series_d: number, char_d: number, rel_err: number };

export let recognize: (url: string, log_file: boolean) => Promise<OCR_Data[]> = undefined;
export let load = (async (worker_count: number) => {


    await load_module;
    await load_backend(worker_count);
    console.log("ocr ready");


	recognize = async (url: string, log_file: boolean = false) => {	
        let meta: sharp.Metadata, images: number;
        try {
            let begin = Date.now();        
            // @ts-ignore
            let img: sharp.Sharp = sharp.default(await (await fetch(url)).buffer()).grayscale() ;
            meta = await img.metadata();
            let four_drop = meta.width > 1000; 
        
            images = four_drop ? 4 : 3;
        //	console.log(`fetch took ${Date.now() - begin}ms`);
        //	begin = Date.now();

            let contrast = 2;
            let offset = 20;
            let pipe = (img: sharp.Sharp): sharp.Sharp => img.linear(contrast, - (128 * contrast) + 128 + offset); // sharpen?
            let [series_images, char_images] = await Promise.all(
                [
                    Promise.all(Array(images).fill(null).map((_, i) => prepare(pipe(img.extract(rectanglesSeries[i]))))),
                    Promise.all(Array(images).fill(null).map((_, i) => prepare(pipe(img.extract(rectangles[i])))))
                ]);
        
        //  img.toFile("img.png");
            let data: Array<OCR_Data> = [];

            let series_matches: Array<Array<[number, string]>> = Array(4).fill(null);
            let raw_s: Array<string> = Array(4).fill(null);
            let raw_c: Array<string> = Array(4).fill(null);
            let series_promise: Array<Promise<RecognizeResult>> = Array(4).fill(undefined);
            let char_promise: Array<Promise<RecognizeResult>> = Array(4).fill(undefined);
            console.log(`processing took ${Date.now() - begin}ms`);
            begin = Date.now();
            let relayout = (v: RecognizeResult): [string, Word[]] => {
                if(v.data.words.length == 0) {
                    return ["", []];
                }
                let heights = v.data.words.map(w => w.symbols.map(s => s.bbox.y1 - s.bbox.y0)).flat();
  
                let avr_height = heights.reduce((a, b) => a + b) / heights.length;
                let filtered = v.data.words.map(w => {
                    let word: Word = {
                        ...w
                    }
                    let new_symbols = w.symbols.filter(s => s.bbox.y1 - s.bbox.y0 < avr_height * 1.5);
                    if (new_symbols.length != w.symbols.length) {
                        word.symbols = new_symbols;
                        let bbox = { y0: Infinity, y1: -Infinity, x0: Infinity, x1: -Infinity };
                        new_symbols.map(s => {
                            bbox.y1 = Math.max(s.bbox.y1, bbox.y1);
                            bbox.x1 = Math.max(s.bbox.x1, bbox.x1);
                            bbox.y0 = Math.min(s.bbox.y0, bbox.y0);
                            bbox.x0 = Math.min(s.bbox.x0, bbox.x0);
                        });
                        word.bbox = bbox;
                    }
                    return word;
                });
                let sorted = filtered.sort((a, b) => Math.abs(a.bbox.y1 - b.bbox.y1) < avr_height * 0.7 ? a.bbox.x0 - b.bbox.x0 : a.bbox.y1 - b.bbox.y1);
                return [sorted.reduce((p, c) => p + " " + c.text, "").trim(), sorted];
            }

            let debug = async (v: Word[], v_old: Word[], rect: typeof rectangles[0], filename: string) => {

                let part = pipe(img.extract(rect));
                part.toFile(filename);
         /*       part.composite([
                        ...v.map(w => sharp_rect(w.bbox, "green")),
                        ...v_old.filter(w => !v.includes(w)).map(w => sharp_rect(w.bbox, "red")),

                    ]).toFile(filename);*/

            }
       /*     let _begin = Date.now();
            let hash = createHash("md5");
            hash.update(series_images[0])
            hash.update(char_images[0])
            console.log(`hash ${hash.digest("hex")} in ${Date.now() - _begin}ms`);*/

            for (let i = 0; i < images; i++) {
              
                
                series_promise[i] = schedule(series_images[i]);
            }
        //	console.log(`series took ${Date.now() - begin}ms`);
        //	begin = Date.now();

            for (let i = 0; i < images; i++) {
                char_promise[i] = schedule(char_images[i]);
            }

            for (let i = 0; i < images; i++) {
                let v_s = await series_promise[i];
                let v_c = await char_promise[i];
                if(v_s.data.words.length == 0) {
                    console.log(url, i);
                }
                let [text_s, w_s] = relayout(v_s);
                let [text_c, w_c] = relayout(v_c);

                if(log_file) {
                    await debug(w_c, v_c.data.words, rectangles[i], `ocr_debug/char_${i}.png`);
                    await debug(w_s, v_s.data.words, rectanglesSeries[i], `ocr_debug/seri_${i}.png`);
                }
                /*
                let text_s = v_s.data.text.replace(/\n/g, "").trim();
                let text_c = v_c.data.text.replace(/\n/g, "").trim();*/
                series_matches[i] = series_strs.map(c => [ls(text_s, c), c]).sort((a, b) => a[0] - b[0]).slice(0, 10) as Array<[number, string]>;
                raw_c[i] = text_c;
                raw_s[i] = text_s;
                let m = series_matches[i].map((ds) => ({ sd: ds[0], ser: ds[1], chars: character_strs(ds[1])}))
                    .map(dsc => ({  sd: dsc.sd, ser: dsc.ser, char: dsc.chars.map((c) => ({ cd: ls(raw_c[i], c) as number, char: c}))
                    .reduce((prev, curr) => {
                        return prev.cd < curr.cd ? prev : curr;
                    })})).reduce((prev, curr) => {
                        return prev.sd + prev.char.cd < curr.sd + curr.char.cd ? prev : curr;
                    });

                data.push({ 
                    series: m.ser,
                    series_d:  m.sd,
                    char: m.char.char,
                    char_d:  m.char.cd,
                    raw_s: raw_s[i],
                    raw_c: raw_c[i],
                    rel_err: (m.char.cd + m.sd) / (Math.max(m.char.char.length, raw_c[i].length) + Math.max( m.ser.length, raw_s[i].length)),
                });
            } 
            console.log(`rest took ${Date.now() - begin}ms`);

            return data;
        } catch (error) {
            console.log(meta, images);
            return Promise.reject(error);
        }
	}


 
});
