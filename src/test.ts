
import { createWorker, Worker } from 'tesseract.js';
import { readFileSync } from 'fs';
import ls from 'js-levenshtein';
import * as IJS from 'image-js';
import { series_strs, character_strs, klu_data } from './shared/klu_data.js';
import fetch from 'node-fetch-commonjs';





let workers: Array<Worker> = [];
const rectangles = [
    {
        left: 46,
        top: 57,
        width: 195,
        height: 49,
    },
    {
        left: 321,
        top: 57,
        width: 195,
        height: 49,
    },
    {
        left: 594,
        top: 57,
        width: 195,
        height: 49,
    },
    {
        left: 869,
        top: 57,
        width: 195,
        height: 49,
    },
];

const rectanglesSeries = [
    {
      left: 46,
      top: 309,
      width: 182,
      height: 49,
    },
    {
      left: 326,
      top: 309,
      width: 182,
      height: 49,
    },
    {
      left: 594,
      top: 309,
      width: 182,
      height: 49,
    },
    {
      left: 869,
      top: 309,
      width: 182,
      height: 49,
    },
  ];
  


let to_date = (time: string) => Number(((BigInt(time) >> BigInt(22)) + BigInt(1420070400000)) / BigInt(1000));

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
type OCR_Data = {series: string, char: string, raw_s: string, raw_c: string,series_d: number, char_d: number, rel_err: number };

let recognize: (url: string) => Promise<OCR_Data[]> = undefined;
let load = (async () => {
    for(let i = 0; i < 8; i++) {
        let worker = createWorker();
        await worker.load();
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
    
    
        await worker.setParameters({
            tessedit_char_whitelist: "6314Cicad#ompsRurkSn YevM'5JjAtH-W0NhgOTFwbKIyVlqGBzDPL=xöf78*:U./QE29Z&+()ü%–Xéá!,?×ôëâ[]²\"è~º;_³ÉíäðúóÓåç@ï°ÖòßñàÜµ{}êýÄû—½øìþ$"
        });
        workers.push(worker);

    }
    console.log("ocr ready");



	recognize = async (url: string) => {	
		let begin = Date.now();
		let image = await IJS.Image.load(await (await fetch(url)).arrayBuffer());
        let four_drop = image.width > 1000;
        let images = four_drop ? 4 : 3;
	//	console.log(`fetch took ${Date.now() - begin}ms`);
		begin = Date.now();
		let mask =image.grey({algorithm: 'lightness' as IJS.GreyAlgorithm.LIGHTNESS });
		let result= mask.mask();
		let blob = result.toBuffer().buffer;
		let data: Array<OCR_Data> = [];

		let series_matches: Array<Array<[number, string]>> = Array(4).fill(null);
		let raw_s: Array<string> = Array(4).fill(null);
        let raw_c: Array<string> = Array(4).fill(null);
        let series_promise: Array<Promise<void>> = Array(4).fill(undefined);
        let char_promise: Array<Promise<void>> = Array(4).fill(undefined);
	//	console.log(`processing took ${Date.now() - begin}ms`);
		begin = Date.now();
		for (let i = 0; i < images; i++) {
            await workers[i].recognize(blob as Buffer, { rectangle: rectanglesSeries[i] }).then((v) => {
                let text = v.data.text.replace(/\n/g, "").trim();
		
                series_matches[i] = series_strs.map(c => [ls(text, c), c]).sort((a, b) => a[0] - b[0]).slice(0, 10) as Array<[number, string]>;

                raw_s[i] = text;
        
            });
		}
	//	console.log(`series took ${Date.now() - begin}ms`);
		begin = Date.now();

		for (let i = 0; i < images; i++) {
            await workers[i + 4].recognize(blob as Buffer, { rectangle: rectangles[i] }).then((v) => {
                let text = v.data.text.replace(/\n/g, "").trim();
		
                raw_c[i] = text;
            });
        }

        for (let i = 0; i < images; i++) {
          //  await series_promise[i];
        //    await char_promise[i];

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
				rel_err: (m.char.cd + m.sd) / (m.char.char.length + m.ser.length),
			});
		} 
	//	console.log(`char took ${Date.now() - begin}ms`);
		begin = Date.now();
	//	console.log(url, data, series_matches);
		return data;
	}


 
})();


let queue: Array<{ url: string, callback: (data: OCR_Data[]) => void }> = [];
export let ocr = async (url: string, callback: (data: OCR_Data[]) => void) => {
    await load
    queue.unshift({ url, callback });
    if(queue.length > 4)
        queue.pop()
    
}

(async () => {
    let i = 0;
    while(true) {
        
    
        if(queue.length == 0) {
            await sleep(100);
            continue;
        }
        let a = queue.shift();
  
       
        await recognize(a.url).then(a.callback);
       
    }
})();


setInterval(() => {
    ocr("https://cdn.discordapp.com/attachments/932713994886721576/1006612759649194006/card.webp", (data) => console.log("a"));
}, 500);