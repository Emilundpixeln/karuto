

/*
import {VM, VMScript} from 'vm2';
import {collect, collect_by_prefix} from './collector.js';


let scripts: Array<VMScript> = [];




collect((msg) => {
    if(msg.channelId != "887047967528321134") return;
    if(msg.author.id == msg.client.user.id) return;




    scripts.map((script) => {
        const vm = new VM({
            timeout: 1000,
            allowAsync: false,
            sandbox: {
                msg: {
                    content: msg.content,
                    id: msg.id,
                    guildId: msg.guildId,
                    channelId: msg.channelId,
                    author: msg.author.id,
                },
                to_date: (time: string): number => typeof time == "string" ? Number(((BigInt(time) >> BigInt(22)) + BigInt(1420070400000)) / BigInt(1000)) : 0,
            }
        });
        
        let ret = undefined;
      //  try {
            ret = vm.run(script);
        //} catch (_) { console.log("Script errored"); }   
        
        if(typeof ret == 'string') {
            msg.reply(ret);
        } else {
            console.log("typeof ret err");
        }
        
    });
});


collect_by_prefix("ohook", (msg, cont) => {
    if(msg.channelId != "887047967528321134") return;
    if(msg.author.id != "261587350121873408") return;

    cont = cont.trim();
    if(cont.startsWith("```") && cont.endsWith("```"))
        cont= cont.substr(3, cont.length - 6);

    let script_text = `
        let p_return = undefined;
        let reply = (text) => {
            p_return = text;
        };
        ${cont};

        p_return
    `;

    scripts.push(new VMScript(script_text));
});

*/