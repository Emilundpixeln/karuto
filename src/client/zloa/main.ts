import { effect } from "zod";
import { on_client_available } from "../collector.js";
import {
    ark_passive,
    cooldown_reduction_for_stat,
    crit_rate_for_stat,
    elixir_effects,
    elixir_level,
    elixir_names,
    elixir_sets,
    engravings,
    main_stat_by_ah,
    main_stat_by_grade,
    ScaledStat,
    Stats,
    stats,
    stone_effects,
    stone_level,
    transcendence,
    weapon_power_by_grade,
} from "./data.js";
import { raw_data } from "./raw.js";

function assert<T>(value: T): asserts value is NonNullable<T> {
    if (value === null || value === undefined) {
        throw Error("assert null or undefined");
    }
}

const scrape_data = (character: string, region: string) => {
    const data = raw_data;

    const loadout = data.data[2]?.data.loadouts?.find((l) => l.type == "raid_merged");
    const weapon = loadout?.items.find((i) => i.slot == "weapon");
    assert(weapon);

    const stone = loadout?.items.find((i) => i.slot == "ability_stone");
    assert(stone);
    const bracelet = loadout?.items.find((i) => i.slot == "bracelet");
    assert(bracelet);
    const additional_damage = weapon.data.stats!.find((s) => stats[s.index] == "Additional Damage")!.value / 10000;
    const weapon_power = weapon_power_by_grade[weapon.data.honing!] + main_stat_by_ah[weapon.data.advancedHoning!];
    const main_stat = loadout?.items
        .filter((i) => ["head", "upper_body", "lower_body", "hand", "shoulder"].includes(i.slot))
        .map((i) => (assert(i.data.honing), main_stat_by_grade[i.data.honing] + main_stat_by_ah[i.data.advancedHoning]))
        .reduce((a, b) => a + b, 0);
    assert(loadout);
    assert(weapon_power);
    assert(main_stat);

    return {
        header: data.data[1]?.data as unknown as {
            ilvl: number;
            world: string;
            class: string;
            level: number;
            rosterLevel: number;
        },
        weapon_power,
        main_stat,
        additional_damage,
        stone: stone.data.engravings!,
        bracelet: bracelet.data.stats!,
        loadout: loadout as unknown as {
            lastUpdated: string;
            apPoints: {
                enlightenment: number;
                evolution: number;
                leap: number;
            };
            cards: {
                id: number;
                level: number;
            }[];
            transcendences: {
                leaves: number[];
                level: number;
                slot: "weapon" | "head" | "upper_body" | "lower_body" | "hand" | "shoulder";
            }[];
            elixirs: {
                slot: string;
                id: number;
                effects: {
                    id: number;
                    points: number;
                }[];
            }[];
            gems: {
                slot: number;
                id: number;
                effects: [
                    {
                        type: "skill_cooldown_reduction" | "skill_damage";
                        id: number;
                        value: number;
                    },
                    {
                        type: "stat";
                        id: number;
                        value: number;
                    }
                ];
            }[];
            stats: {
                type: number;
                value: number;
            }[];
            loadout: {
                type: string;
                engravings: {
                    grade: string;
                    id: number;
                    progress: number;
                }[];
                arkPassive: {
                    evolution: {
                        id: number;
                        level: number;
                    }[];
                    enlightenment: {
                        id: number;
                        level: number;
                    }[];
                    leap: {
                        id: number;
                        level: number;
                    }[];
                };
            };
        },
    };
};

function apply(stats: Stats, partial: Partial<Stats>): Stats {
    const {
        weapon_power,
        main_stat,
        additional_damage,
        extra_ap,
        base_ap,
        damage_multiplier,
        crit_rate,
        crit_damage,
        damage_on_crit,
        cooldown_reduction,
        blunt_thorn,
        evolution_damage,
        increased_attack_power,
        increased_weapon_power,
    } = stats;
    return {
        weapon_power: weapon_power + (partial.weapon_power ?? 0),
        main_stat: main_stat + (partial.main_stat ?? 0),
        additional_damage: additional_damage + (partial.additional_damage ?? 0),
        extra_ap: extra_ap + (partial.extra_ap ?? 0),
        base_ap: base_ap + (partial.base_ap ?? 0),
        damage_multiplier: damage_multiplier * (1 + (partial.damage_multiplier ?? 0)),
        crit_rate: crit_rate + (partial.crit_rate ?? 0),
        crit_damage: crit_damage + (partial.crit_damage ?? 0),
        damage_on_crit: damage_on_crit * (1 + (partial.damage_on_crit ?? 0)),
        cooldown_reduction: cooldown_reduction + (partial.cooldown_reduction ?? 0),
        blunt_thorn: blunt_thorn + (partial.blunt_thorn ?? 0),
        evolution_damage: evolution_damage + (partial.evolution_damage ?? 0),
        increased_attack_power: increased_attack_power + (partial.increased_attack_power ?? 0),
        increased_weapon_power: increased_weapon_power + (partial.increased_weapon_power ?? 0),
    };
}

function scale(stats: Partial<Stats>, factor: number): Partial<Stats> {
    return Object.fromEntries(Object.entries(stats).map(([key, value]) => [key, value * factor]));
}

function scaledStat(stats: Partial<ScaledStat>, level: number): Partial<Stats> {
    return Object.fromEntries(
        Object.entries(stats).map(([key, value]) => [key, typeof value == "number" ? value : value[level]])
    );
}

function evalStats(stats: Stats) {
    const weapon_power = stats.weapon_power * (1 + stats.increased_weapon_power);
    const main_stat = stats.main_stat;
    const attack_power =
        (Math.sqrt((weapon_power * main_stat) / 6) + stats.extra_ap) *
        (1 + stats.base_ap) *
        (1 + stats.increased_attack_power);

    let crit_rate = stats.crit_rate;
    let evolution_damage = stats.evolution_damage;
    if (stats.blunt_thorn > 0) {
        const extra_crit = Math.max(0, crit_rate - 0.8);
        const evol = Math.min(0.3 + 0.2 * stats.blunt_thorn, 0.2 * stats.blunt_thorn * extra_crit);
        console.log("blunt thorn =", evol, " crit =", crit_rate);
        evolution_damage += evol;
        crit_rate = Math.min(crit_rate, 0.8);
    }
    crit_rate = Math.min(1, crit_rate);

    const non_crit =
        attack_power *
        (1 + stats.additional_damage) *
        stats.damage_multiplier *
        (1 + stats.cooldown_reduction) *
        (1 + evolution_damage);

    const with_crits =
        (1 - crit_rate) * non_crit + crit_rate * non_crit * (1 + stats.crit_damage) * stats.damage_on_crit;

    console.log("damage", stats, "=", with_crits);
    return with_crits;
}

function calculate(character: string, region: string) {
    const data = scrape_data(character, region);

    let base_stats: Stats = {
        weapon_power: data.weapon_power,
        main_stat: data.main_stat,
        additional_damage: data.additional_damage,
        base_ap: data.loadout.gems
            .map((g) => (g.effects.find((e) => stats[e.id] == "Basic Atk. Power")?.value ?? 0) / 10000)
            .reduce((a, b) => a + b, 0),
        extra_ap: 0,
        damage_multiplier: 1,
        crit_rate: 65 * crit_rate_for_stat + 0.1, // atleast 1 crit syn?
        crit_damage: 2,
        damage_on_crit: 1,
        cooldown_reduction: 70 * cooldown_reduction_for_stat,
        blunt_thorn: 0,
        evolution_damage: 0.14, // supp
        increased_attack_power: 0,
        increased_weapon_power: 0,
    };

    base_stats = data.loadout.loadout.arkPassive.evolution.reduce(
        (prev, s) => apply(prev, scale(ark_passive[s.id][2], s.level)),
        base_stats
    );

    const no_engrave = evalStats(base_stats);
    base_stats = data.loadout.loadout.engravings
        .map((e) => ({
            id: e.id,
            level: e.grade == "engrave_grade05" ? 4 : e.grade == "engrave_grade04" ? Math.floor(e.progress / 5) : 0,
        }))
        .map((e) => scaledStat(engravings[e.id][2], e.level))
        .reduce((prev: Stats, s) => apply(prev, s), base_stats);

    const no_stone = evalStats(base_stats);
    console.log(no_stone / no_engrave);

    base_stats = data.stone.filter(e => stone_level[e.nodes] >= 1).map(e => scaledStat(stone_effects[e.id][2], stone_level[e.nodes] - 1)).reduce((prev: Stats, s) => apply(prev, s), base_stats);

    const no_elixir = evalStats(base_stats);
    console.log(no_elixir / no_stone);

    const elixir_points = data.loadout.elixirs
        .flatMap((elixir) => elixir.effects)
        .map((effect) => elixir_level[effect.points])
        .reduce((a, b) => a + b, 0);
    const effects = data.loadout.elixirs.flatMap((elixir) => elixir.effects);
    base_stats = effects
        .filter((effect) => elixir_level[effect.points] >= 1)
        .map((effect) =>
            scaledStat(
                elixir_effects[elixir_names[effect.id as keyof typeof elixir_names]],
                elixir_level[effect.points] - 1
            )
        )
        .reduce((prev: Stats, s) => apply(prev, s), base_stats);
    const effect_names = effects.map((e) => elixir_names[e.id as keyof typeof elixir_names]);
    const chaosEffect = effect_names.find((e) => e.endsWith("(Chaos)"))?.replace(" (Chaos)", "");
    const orderEffect = effect_names.find((e) => e.endsWith("(Order)"))?.replace(" (Order)", "");
    if (elixir_points >= 35 && chaosEffect != undefined && chaosEffect == orderEffect) {
        base_stats = apply(base_stats, scaledStat(elixir_sets[chaosEffect], elixir_points >= 40 ? 1 : 0));
    }

    const no_trans = evalStats(base_stats);
    console.log(no_trans / no_elixir);

    const transcendence_leaves = data.loadout.transcendences.flatMap((t) => t.leaves).reduce((a, b) => a + b, 0);
    base_stats = data.loadout.transcendences
        .map((t) => ({ slot: t.slot, level: t.leaves.reduce((a, b) => a + b, 0) }))
        .filter((t) => t.level >= 5)
        .map((t) =>
            scale(
                scaledStat(transcendence[t.slot], Math.floor(t.level / 5) - 1),
                t.slot == "head" ? transcendence_leaves : 1
            )
        )
        .reduce((prev: Stats, s) => apply(prev, s), base_stats);



        
    const full = evalStats(base_stats);
    console.log(full / no_trans);
}

on_client_available(async (c) => {
    calculate("", "");
});
