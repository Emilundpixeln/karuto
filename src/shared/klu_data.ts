import { readFileSync } from "fs"

export let klu_data = JSON.parse(readFileSync("good_klu_data.json", { encoding: "utf-8" })).store;
export let wl_data = JSON.parse(readFileSync("wl_data.json", { encoding: "utf-8" }));

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
 

export let series_strs = Object.keys(wl_data);
export let character_strs = (series: string) => Object.keys(wl_data[series]) as Array<string>;
