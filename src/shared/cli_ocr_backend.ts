
import ls from 'js-levenshtein';
import * as sharp from 'sharp';
import { series_strs, character_strs, wl_data } from './klu_data.js';
import fetch from 'node-fetch-commonjs';


type RecognizeResult = {
    
};

type Bbox = {
    x0: number, x1: number, y0: number, y1: number
};

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
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let schedule = async (input: Buffer): Promise<RecognizeResult> => {

    return {};
}

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
                    Promise.all(Array(images).fill(null).map((_, i) => pipe(img.extract(rectanglesSeries[i])).toFile(Math.random().toString().slice(2) + ".png"))),
                    Promise.all(Array(images).fill(null).map((_, i) => pipe(img.extract(rectangles[i])).toFile(Math.random().toString().slice(2) + ".png")))
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
          
            return data;
        } catch (error) {
            console.log(meta, images);
            return Promise.reject(error);
        }
	}


 
});
