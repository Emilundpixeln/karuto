import { readFileSync } from "fs"

export let klu_data = undefined as { [series: string]: { [character: string]: string }};
export let wl_data = undefined as { [series: string]: { [character: string]: { wl: number, date: number }}};
export const wl_data_too_new = -1;

export let url_to_ident = (url: string) => {

    let query_param = url.search(/\?u=\d+$/g);
    if(query_param != -1)
        url = url.slice(0, query_param);

    let versioned_url = "http://d2l56h9h5tj8ue.cloudfront.net/images/cards/versioned/";
    let unversioned_url = "http://d2l56h9h5tj8ue.cloudfront.net/images/cards/";
    
    if(url.search(versioned_url) != -1) {
        let end = url.search(/-\d+-\d+\.jpg/g);
        let start = versioned_url.length;


        return url.slice(start, end);
    } else {
        let end = url.search(/-\d+\.jpg/g);
        let start = unversioned_url.length

    
        return url.slice(start, end);
    }
}
 
export let url_to_ed = (url: string) => {
    let versioned_url = "http://d2l56h9h5tj8ue.cloudfront.net/images/cards/versioned/";
    
    if(url.search(versioned_url) != -1) {
        return parseInt(/-(\d+)-\d+\.jpg/g.exec(url)[1]);
    } else {
        return parseInt(/-(\d+)\.jpg/g.exec(url)[1]);
    }
}

export let ident_to_url = (ident: string, ed: number, versioned: boolean, version: number = 0) => {
    if(versioned)
        return `http://d2l56h9h5tj8ue.cloudfront.net/images/cards/versioned/${ident}-${ed}-${version}.jpg`;
    else
        return `http://d2l56h9h5tj8ue.cloudfront.net/images/cards/${ident}-${ed}.jpg`;
}


export let series_strs = undefined as string[];
export let character_strs = (series: string) => Object.keys(wl_data[series]) as Array<string>;

export const wl_data_path = "wl_data.json";

export let reload_data = () => {
    klu_data = JSON.parse(readFileSync("good_klu_data.json", { encoding: "utf-8" })).store;
    wl_data = JSON.parse(readFileSync(wl_data_path, { encoding: "utf-8" }));
    series_strs = Object.keys(wl_data);
};



reload_data();