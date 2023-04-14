import { readFileSync } from "fs";

export let klu_data = {} as { [series: string]: { [character: string]: string } };
export let wl_data = {} as { [series: string]: { [character: string]: { wl: number, date: number } } };
export const wl_data_too_new = -1;

export const url_to_ident = (url: string) => {

    const query_param = url.search(/\?u=\d+$/g);
    if(query_param != -1)
        url = url.slice(0, query_param);

    const versioned_url = "http://d2l56h9h5tj8ue.cloudfront.net/images/cards/versioned/";
    const unversioned_url = "http://d2l56h9h5tj8ue.cloudfront.net/images/cards/";

    if(url.search(versioned_url) != -1) {
        const end = url.search(/-\d+-\d+\.jpg/g);
        const start = versioned_url.length;


        return url.slice(start, end);
    } else {
        const end = url.search(/-\d+\.jpg/g);
        const start = unversioned_url.length;


        return url.slice(start, end);
    }
};

export const url_to_ed = (url: string) => {
    const versioned_url = "http://d2l56h9h5tj8ue.cloudfront.net/images/cards/versioned/";

    if(url.search(versioned_url) != -1) {
        const match = /-(\d+)-\d+\.jpg/g.exec(url);
        if(!match) return undefined;
        return parseInt(match[1]);
    } else {
        const match = /-(\d+)\.jpg/g.exec(url);
        if(!match) return undefined;
        return parseInt(match[1]);
    }
};

export const ident_to_url = (ident: string, ed: number, versioned: boolean, version = 0) => {
    if(versioned)
        return `http://d2l56h9h5tj8ue.cloudfront.net/images/cards/versioned/${ident}-${ed}-${version}.jpg`;
    else
        return `http://d2l56h9h5tj8ue.cloudfront.net/images/cards/${ident}-${ed}.jpg`;
};


export let series_strs = [] as string[];
export const character_strs = (series: string) => Object.keys(wl_data[series]) as Array<string>;

export const wl_data_path = "wl_data.json";

export const reload_data = () => {
    klu_data = JSON.parse(readFileSync("good_klu_data.json", { encoding: "utf-8" })).store;
    wl_data = JSON.parse(readFileSync(wl_data_path, { encoding: "utf-8" }));
    series_strs = Object.keys(wl_data);
};



reload_data();