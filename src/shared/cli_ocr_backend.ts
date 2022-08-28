import { RecognizeResult, Word } from "./ocr_backend_shared.js"
import * as sharp from 'sharp';
import { unlink } from "fs"
import { execFile } from "child_process" 
import { promisify } from "util" 

const execFileP = promisify(execFile);

function decodeEntities(encodedString: string) {
    var translate_re = /&(nbsp|amp|quot|lt|gt);/g;
    var translate = {
        "nbsp":" ",
        "amp" : "&",
        "quot": "\"",
        "lt"  : "<",
        "gt"  : ">"
    };
    return encodedString.replace(translate_re, function(match, entity) {
        return translate[entity];
    }).replace(/&#(\d+);/gi, function(match, numStr) {
        var num = parseInt(numStr, 10);
        return String.fromCharCode(num);
    });
}

export let load_backend = async (worker_count: number) => {}

export let schedule = async (input: Buffer | string): Promise<RecognizeResult> => {
    let file_name = input as string;

    return execFileP("tesseract", [file_name, "-", "-c", "hocr_char_boxes=1", "hocr"]).then((v) => {
        let out = v.stdout;

        let words = [] as Word[];
        
        for(let line of out.split("\n")) {
            let is_word = line.indexOf("<span class='ocrx_word'") != -1;
            let is_char = line.indexOf("<span class='ocrx_cinfo'") != -1;

            if(is_word) {
                let rege = /'bbox (\d+) (\d+) (\d+) (\d+);/g.exec(line);
                if(!rege) console.error(line);
                words.push({
                    symbols: [],
                    bbox: {
                        x0: parseInt(rege[1]),
                        y0: parseInt(rege[2]),
                        x1: parseInt(rege[3]),
                        y1: parseInt(rege[4])
                    },
                    text: ""
                });
            }
            else if(is_char) {
                let rege = /'x_bboxes (\d+) (\d+) (\d+) (\d+); x_conf [\d\.]+'>([^<]+)<\/span>/g.exec(line);
                if(!rege) console.error(line);
                words[words.length - 1].symbols.push({
                    bbox: {
                        x0: parseInt(rege[1]),
                        y0: parseInt(rege[2]),
                        x1: parseInt(rege[3]),
                        y1: parseInt(rege[4])
                    }
                });
                words[words.length - 1].text += decodeEntities(rege[5]);
               
            }
        }


        return {
            data: {
                words
            }
        }
    }).finally(() => {
        unlink(file_name, () => {});
    });
}

export let prepare = async (image: sharp.Sharp): Promise<Buffer | string> => {
    let name = `tmp/${Math.random().toString().slice(2)}.png`;
    return image.toFile(name).then(_ => name);
}