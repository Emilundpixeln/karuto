import { collect, collect_by_prefix, register_command, SlashCommand } from "../collector.js";
import {
    ark_passive,
    special_effects,
    crit_rate_for_stat,
    effect_for_base_stat,
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
    classes,
    karma_rank_effects,
    karma_level_effects,
    weapon_power_by_grade_esther,
    esther_weapons,
    weapon_power_by_ah,
    cooldown_reduction_for_stat,
    supp_info,
    gem_types,
    UptimedPartialScaledStat,
    common_elixir_effects,
} from "./data.js";
import { raw_data } from "./raw.js";
import { skins } from "./static_skins.js";

function assert<T>(value: T): asserts value is NonNullable<T> {
    if (value === null || value === undefined) {
        throw Error("assert null or undefined");
    }
}

function sum(a: number, b: number) {
    return a + b;
}

async function fetch_data(character: string, region: string) {
    try {
        const res = await fetch(`https://uwuowo.mathi.moe/character/${encodeURI(region)}/${encodeURI(character)}`);
        const text = await res.text();
        const startIndex = text.indexOf("kit.start(app, element, ") + "kit.start(app, element, ".length;
        const endIndex = text.indexOf("form: null");
        if (startIndex < "kit.start(app, element, ".length) {
            throw "marker not found";
        }
        if (endIndex == -1) {
            throw "end marker not found";
        }
        const obj = text.substring(startIndex, endIndex) + "}";
        return eval(`(${obj})`) as typeof raw_data;
    } catch (error) {
        console.log(error);
        return { error };
    }
}

const scrape_data = (data: typeof raw_data) => {
    const loadout =
        data.data[2]?.data.loadouts?.find((l) => l.type == "raid_merged") ??
        data.data[2]?.data.loadouts?.find((l) => l.type == "most_recent_raid");
    const weapon = loadout?.items.find((i) => i.slot == "weapon");
    assert(weapon);

    loadout!.loadout.arkPassive ??= {
        evolution: [],
        enlightenment: [],
        leap: [],
    };

    const stone = loadout?.items.find((i) => i.slot == "ability_stone");
    assert(stone);
    const bracelet = loadout?.items.find((i) => i.slot == "bracelet");
    assert(bracelet);
    const accessories = loadout?.items
        .filter(
            (i) => ["neck", "ear1", "ear2", "finger1", "finger2"].includes(i.slot) && i.data.type == "tier4_accessory"
        )
        .map((i) => ({ slot: i.slot, stats: i.data.stats }));
    assert(bracelet);
    const additional_damage = weapon.data.stats!.find((s) => stats[s.index] == "Additional Damage")!.value / 10000;
    const weapon_power =
        (esther_weapons.includes(weapon.id)
            ? weapon_power_by_grade_esther[weapon.data.honing!]
            : weapon_power_by_grade[weapon.data.honing!]) + weapon_power_by_ah[weapon.data.advancedHoning!];
    const main_stat = loadout?.items
        .filter((i) => ["head", "upper_body", "lower_body", "hand", "shoulder"].includes(i.slot))
        .map((i) => (assert(i.data.honing), main_stat_by_grade[i.data.honing] + main_stat_by_ah[i.data.advancedHoning]))
        .reduce(sum, 0);
    assert(loadout);
    assert(weapon_power);
    assert(main_stat);

    let extra_brand_power = (loadout.stats.find((s) => s.type == 46)?.value ?? 0) * 0.0001;
    const weapon_trans_level = Math.floor(
        (loadout.transcendences.find((t) => t.slot == "weapon")?.leaves?.reduce(sum, 0) ?? 0) / 5
    );
    extra_brand_power -= [0, 0.02, 0.02, 0.04, 0.08][weapon_trans_level];
    extra_brand_power -=
        (accessories?.find((i) => i.slot == "neck")?.stats?.find((s) => stats[s.index] == "Brand Power")?.value ?? 0) *
        0.0001;
    extra_brand_power -=
        (loadout.loadout.arkPassive.evolution.find((e) => ark_passive[e.id][0] == "Standing Striker")?.level ?? 0) *
        0.04;
    extra_brand_power -=
        (loadout.loadout.arkPassive.evolution.find((e) => ark_passive[e.id][0] == "MP Furnace")?.level ?? 0) * 0.1;
    extra_brand_power -=
        (loadout.loadout.arkPassive.evolution.find((e) => ark_passive[e.id][0] == "Stable Manager")?.level ?? 0) * 0.1;
    const karma_evolution_rank = Math.max(0, Math.floor(extra_brand_power * 100 + /*floating point error :(*/ 0.01));

    let extra_enlightenment_points = loadout.apPoints.enlightenment;
    extra_enlightenment_points -=
        20 +
        3 +
        3 +
        5 +
        (accessories?.map((a) => a.stats?.find((s) => s.type == 57 /*evolution_points*/)?.value ?? 0)?.reduce(sum, 0) ??
            0);
    extra_enlightenment_points = Math.max(0, extra_enlightenment_points);

    assert(bracelet.id == 213300023 || bracelet.id == 213400023);

    let extra_leap_points = loadout.apPoints.leap;
    extra_leap_points -= 40 + (bracelet.id == 213300023 ? 9 : 18);
    const karma_leap_rank = Math.floor(Math.max(extra_leap_points, 0) / 2);

    const karma = {
        evolution: {
            rank: karma_evolution_rank,
            level: [0, 1, 5, 9, 13, 17, 25][karma_evolution_rank],
        },
        enlightenment: {
            rank: extra_enlightenment_points,
            level: [0, 1, 5, 9, 13, 17, 25][extra_enlightenment_points],
        },
        leap: {
            rank: karma_leap_rank,
            level: [0, 1, 5, 9, 13, 17, 25][karma_leap_rank],
        },
    } as const;

    const skin_slots = ["avatar_weapon", "avatar_upper_body", "avatar_lower_body", "avatar_head"] as const;


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
        karma,
        stone: stone.data.engravings!,
        bracelet: bracelet.data.stats!,
        accessories: accessories as {
            slot: "neck" | "ear1" | "ear2" | "finger1" | "finger2";
            stats: {
                type: number;
                index: number;
                base: boolean;
                id: number;
                value: number;
            }[];
        }[],
        skins: loadout.items.filter(i => skin_slots.includes(i.slot)) as {
            id: number,
            slot: typeof skin_slots[number]
        }[],
        loadout: loadout as unknown as {
            lastUpdated: number;
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
                slot: "head" | "upper_body" | "lower_body" | "hand" | "shoulder";
                id: number;
                effects: {
                    id: number;
                    points: number;
                }[];
            }[];
            gems: {
                slot: number;
                id: number;
                effects: {
                    type: number;
                    id: number;
                    value: number;
                }[];
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

function merge(stats: Partial<Stats>, partial: Partial<Stats>): Stats {
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
        increased_main_stat,
        identity_gain,
        identity_effect,
        brand_power,
        ap_buff_effect,
        outgoing_damage_effect,
        crit_rate_resistance,
        crit_damage_resistance,
        ally_outgoing_damage,
        swift,
        spec,
        crit,
        drops_effect,
        awakening_cooldown,
        identity_for_casting_t,
        t_skill_cooldown_reduction,
    } = {
        weapon_power: 0,
        main_stat: 0,
        additional_damage: 0,
        extra_ap: 0,
        base_ap: 0,
        damage_multiplier: 0,
        crit_rate: 0,
        crit_damage: 0,
        damage_on_crit: 0,
        cooldown_reduction: 0,
        blunt_thorn: 0,
        evolution_damage: 0,
        increased_attack_power: 0,
        increased_weapon_power: 0,
        increased_main_stat: 0,
        identity_gain: 0,
        identity_effect: 0,
        brand_power: 0,
        ap_buff_effect: 0,
        outgoing_damage_effect: 0,
        crit_rate_resistance: 0,
        crit_damage_resistance: 0,
        ally_outgoing_damage: 0,
        swift: 0,
        spec: 0,
        crit: 0,
        drops_effect: 0,
        awakening_cooldown: 0,
        identity_for_casting_t: 0,
        t_skill_cooldown_reduction: 0,
        ...stats,
    };
    return {
        swift: swift + (partial.swift ?? 0),
        spec: spec + (partial.spec ?? 0),
        crit: crit + (partial.crit ?? 0),
        weapon_power: weapon_power + (partial.weapon_power ?? 0),
        main_stat: main_stat + (partial.main_stat ?? 0),
        additional_damage: additional_damage + (partial.additional_damage ?? 0),
        extra_ap: extra_ap + (partial.extra_ap ?? 0),
        base_ap: base_ap + (partial.base_ap ?? 0),
        damage_multiplier: damage_multiplier * (1 + (partial.damage_multiplier ?? 0)),
        crit_rate: crit_rate + (partial.crit_rate ?? 0),
        crit_damage: crit_damage + (partial.crit_damage ?? 0),
        damage_on_crit: damage_on_crit * (1 + (partial.damage_on_crit ?? 0)),
        cooldown_reduction: cooldown_reduction * (1 - (partial.cooldown_reduction ?? 0)),
        blunt_thorn: blunt_thorn + (partial.blunt_thorn ?? 0),
        evolution_damage: evolution_damage + (partial.evolution_damage ?? 0),
        increased_attack_power: increased_attack_power + (partial.increased_attack_power ?? 0),
        increased_weapon_power: increased_weapon_power + (partial.increased_weapon_power ?? 0),
        increased_main_stat: increased_main_stat + (partial.increased_main_stat ?? 0),
        identity_gain: identity_gain + (partial.identity_gain ?? 0),
        identity_effect: identity_effect + (partial.identity_effect ?? 0),
        brand_power: brand_power + (partial.brand_power ?? 0),
        ap_buff_effect: ap_buff_effect + (partial.ap_buff_effect ?? 0),
        outgoing_damage_effect: outgoing_damage_effect + (partial.outgoing_damage_effect ?? 0),
        crit_rate_resistance: crit_rate_resistance + (partial.crit_rate_resistance ?? 0),
        crit_damage_resistance: crit_damage_resistance + (partial.crit_damage_resistance ?? 0),
        ally_outgoing_damage: ally_outgoing_damage + (partial.ally_outgoing_damage ?? 0),
        drops_effect: drops_effect + (partial.drops_effect ?? 0),
        awakening_cooldown: awakening_cooldown + (partial.awakening_cooldown ?? 0),
        identity_for_casting_t: identity_for_casting_t + (partial.identity_for_casting_t ?? 0),
        t_skill_cooldown_reduction: t_skill_cooldown_reduction * (1 - (partial.t_skill_cooldown_reduction ?? 0)),
    };
}

function applyNoLabel(stats: Stats, partial: Partial<Stats>): Stats {
    return merge(stats, partial);
}

function reverse(stats: Partial<Stats>, partial: Partial<Stats>): Partial<Stats> {
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
        increased_main_stat,
        identity_gain,
        identity_effect,
        brand_power,
        ap_buff_effect,
        outgoing_damage_effect,
        crit_rate_resistance,
        crit_damage_resistance,
        ally_outgoing_damage,
        drops_effect,
        identity_for_casting_t,
        t_skill_cooldown_reduction,
    } = {
        weapon_power: 0,
        main_stat: 0,
        additional_damage: 0,
        extra_ap: 0,
        base_ap: 0,
        damage_multiplier: 0,
        crit_rate: 0,
        crit_damage: 0,
        damage_on_crit: 0,
        cooldown_reduction: 0,
        blunt_thorn: 0,
        evolution_damage: 0,
        increased_attack_power: 0,
        increased_weapon_power: 0,
        increased_main_stat: 0,
        identity_gain: 0,
        identity_effect: 0,
        brand_power: 0,
        ap_buff_effect: 0,
        outgoing_damage_effect: 0,
        crit_rate_resistance: 0,
        crit_damage_resistance: 0,
        ally_outgoing_damage: 0,
        drops_effect: 0,
        identity_for_casting_t: 0,
        t_skill_cooldown_reduction: 0,
        ...stats,
    };
    return {
        weapon_power: weapon_power - (partial.weapon_power ?? 0),
        main_stat: main_stat - (partial.main_stat ?? 0),
        additional_damage: additional_damage - (partial.additional_damage ?? 0),
        extra_ap: extra_ap - (partial.extra_ap ?? 0),
        base_ap: base_ap - (partial.base_ap ?? 0),
        damage_multiplier: (1 + damage_multiplier) / (1 + (partial.damage_multiplier ?? 0)) - 1,
        crit_rate: crit_rate - (partial.crit_rate ?? 0),
        crit_damage: crit_damage - (partial.crit_damage ?? 0),
        damage_on_crit: (1 + damage_on_crit) / (1 + (partial.damage_on_crit ?? 0)) - 1,
        cooldown_reduction: 1 - (1 - cooldown_reduction) / (1 - (partial.cooldown_reduction ?? 0)),
        blunt_thorn: blunt_thorn - (partial.blunt_thorn ?? 0),
        evolution_damage: evolution_damage - (partial.evolution_damage ?? 0),
        increased_attack_power: increased_attack_power - (partial.increased_attack_power ?? 0),
        increased_weapon_power: increased_weapon_power - (partial.increased_weapon_power ?? 0),
        increased_main_stat: increased_main_stat - (partial.increased_main_stat ?? 0),
        identity_gain: identity_gain - (partial.identity_gain ?? 0),
        identity_effect: identity_effect - (partial.identity_effect ?? 0),
        brand_power: brand_power - (partial.brand_power ?? 0),
        ap_buff_effect: ap_buff_effect - (partial.ap_buff_effect ?? 0),
        outgoing_damage_effect: outgoing_damage_effect - (partial.outgoing_damage_effect ?? 0),
        crit_rate_resistance: crit_rate_resistance - (partial.crit_rate_resistance ?? 0),
        crit_damage_resistance: crit_damage_resistance - (partial.crit_damage_resistance ?? 0),
        ally_outgoing_damage: ally_outgoing_damage - (partial.ally_outgoing_damage ?? 0),
        drops_effect: drops_effect - (partial.drops_effect ?? 0),
        identity_for_casting_t: identity_for_casting_t - (partial.identity_for_casting_t ?? 0),
        t_skill_cooldown_reduction:
            1 - (1 - t_skill_cooldown_reduction) / (1 - (partial.t_skill_cooldown_reduction ?? 0)),
    };
}

function scale(stats: Partial<Stats>, factor: number): Partial<Stats> {
    return Object.fromEntries(Object.entries(stats).map(([key, value]) => [key, value * factor]));
}
function scaleOrIndexUptimed(
    stats: UptimedPartialScaledStat,
    level: number
): { uptime: number; stats: Partial<Stats> } {
    return { uptime: stats.uptime, stats: scaleOrIndex(stats.stat, level) };
}
function scaleOrIndex(stats: Partial<ScaledStat>, level: number): Partial<Stats> {
    return Object.fromEntries(
        Object.entries(stats).map(([key, value]) => [key, typeof value == "number" ? value * level : value[level - 1]])
    );
}

function scaledStat(stats: Partial<ScaledStat>, level: number): Partial<Stats> {
    return Object.fromEntries(
        Object.entries(stats).map(([key, value]) => [key, typeof value == "number" ? value : value[level]])
    );
}

type LabeledPartialStats = [Partial<Stats>, (typeof systems)[number], string | undefined];

function label(stats: Partial<Stats>, system: (typeof systems)[number], label?: string): LabeledPartialStats {
    return [stats, system, label];
}

const reference_base_stats: Stats = {
    crit: 65,
    swift: 70,
    spec: 69,
    weapon_power: weapon_power_by_grade[14],
    main_stat: main_stat_by_grade[14] * 5,
    additional_damage: 0,
    base_ap: 0,
    extra_ap: 0,
    damage_multiplier: 1,
    crit_rate: 0.1, // 1 crit syn
    crit_damage: 2,
    damage_on_crit: 1,
    cooldown_reduction: 1,
    blunt_thorn: 0,
    evolution_damage: 0.14, // supp
    increased_main_stat: 0,
    increased_attack_power: 0,
    increased_weapon_power: 0,

    identity_gain: 0,
    identity_effect: 0,
    brand_power: 0,
    ap_buff_effect: 0,
    outgoing_damage_effect: 0,
    crit_rate_resistance: 0,
    crit_damage_resistance: 0,
    ally_outgoing_damage: 0,
    drops_effect: 0,
    awakening_cooldown: 0,
    identity_for_casting_t: 0,
    t_skill_cooldown_reduction: 1 - 0.1, // assume 10% t skill cdr for supp from leap tree
};

function formatAsPercent(value: number) {
    return (value * 100).toFixed(2) + "%";
}
function evalDps(weightedStats: WeightedStats, get_stats: false): number;
function evalDps(weightedStats: WeightedStats, get_stats: true): Record<string, string>;
function evalDps(weightedStats: WeightedStats, get_stats = false) {
    const weightedResults = weightedStats.map(({ stats, weight }) => {
        const weapon_power = stats.weapon_power * (1 + stats.increased_weapon_power);
        const main_stat = stats.main_stat * (1 + stats.increased_main_stat);
        const attack_power =
            Math.sqrt((weapon_power * main_stat) / 6) * (1 + stats.base_ap) * (1 + stats.increased_attack_power) +
            stats.extra_ap;

        let crit_rate = stats.crit_rate + stats.crit * crit_rate_for_stat;
        let evolution_damage = stats.evolution_damage;
        const cooldown_multiplier =
            (1 / stats.cooldown_reduction) * (1 / (1 - stats.swift * cooldown_reduction_for_stat));
        let evolution_damage_from_blunt_thorn = 0;
        let blunt_thorn_overcapped = 0;
        let blunt_thorn_overcapped_percent = 0;
        if (stats.blunt_thorn > 0) {
            const extra_crit = Math.max(0, crit_rate - 0.8);
            evolution_damage_from_blunt_thorn = Math.min(
                0.3 + 0.2 * stats.blunt_thorn,
                (1 + 0.2 * stats.blunt_thorn) * extra_crit
            );
            evolution_damage += evolution_damage_from_blunt_thorn;
            blunt_thorn_overcapped = (1 + 0.2 * stats.blunt_thorn) * extra_crit - evolution_damage_from_blunt_thorn;
            blunt_thorn_overcapped_percent =
                (1 + 0.2 * stats.blunt_thorn) * extra_crit > 0.3 + 0.2 * stats.blunt_thorn ? 1 : 0;
            crit_rate = Math.min(crit_rate, 0.8);
        }
        const crit_rate_over_capped = Math.max(crit_rate - 1, 0);
        const crit_rate_over_capped_percent = crit_rate > 1 ? 1 : 0;
        crit_rate = Math.min(1, crit_rate);

        const non_crit =
            attack_power *
            (1 + stats.additional_damage) *
            stats.damage_multiplier *
            cooldown_multiplier *
            (1 + evolution_damage) *
            (1 + (stats.spec * 0.03) / 120);

        const with_crits =
            (1 - crit_rate) * non_crit + crit_rate * non_crit * stats.crit_damage * stats.damage_on_crit;

        return {
            weight,
            values: {
                score: with_crits,
                attack_power,
                crit_rate,
                crit_damage: stats.crit_damage,
                evolution_damage,
                cooldown_reduction: 1 - 1 / cooldown_multiplier,
                blunt_thorn_elovution_damage: evolution_damage_from_blunt_thorn,
                crit_rate_over_capped,
                blunt_thorn_overcapped,
                blunt_thorn_overcapped_percent,
                crit_rate_over_capped_percent,
            },
        };
    });

    assert(Math.abs(weightedResults.reduce((prev, { weight }) => prev + weight, 0) - 1) < 0.001);

    const values = weightedResults.reduce(
        (prev, { weight, values }) =>
            Object.fromEntries(Object.entries(values).map(([key, value]) => [key, (prev[key] ?? 0) + weight * value])),
        {} as Record<string, number>
    ) as (typeof weightedResults)[0]["values"];

    return get_stats
        ? ({
            "Attack Power": values.attack_power.toFixed(0),
            "Crit Rate": formatAsPercent(values.crit_rate),
            "Crit Damage": formatAsPercent(values.crit_damage),
            "Evolution Damage": formatAsPercent(values.evolution_damage),
            "Cooldown Reduction": formatAsPercent(values.cooldown_reduction),
            "Blunt Thorn Evolution Damage": formatAsPercent(values.blunt_thorn_elovution_damage),
            "Average Crit Rate over 100%": formatAsPercent(values.crit_rate_over_capped),
            "Average Blunt Evolution Damage over Maximum": formatAsPercent(values.blunt_thorn_overcapped),
            "Percent of Damage with Crit Rate Over Capped": formatAsPercent(values.crit_rate_over_capped_percent),
            "Percent of Damage with Blunt Thorn Over Capped": formatAsPercent(values.blunt_thorn_overcapped_percent),
            Scenarios: weightedResults.length.toString(),
        } as Record<string, string>)
        : values.score;
}

function evalStats(weightedStats: WeightedStats, config: Config, get_stats: false): number;
function evalStats(weightedStats: WeightedStats, config: Config): number;
function evalStats(weightedStats: WeightedStats, config: Config, get_stats: true): Record<string, string>;
function evalStats(weightedStats: WeightedStats, config: Config, get_stats = false) {
    if (config.type == "dps") {
        // make typescript happy
        return get_stats ? evalDps(weightedStats, true) : evalDps(weightedStats, false);
    }
    const weightedResults = weightedStats.map(({ stats, weight }) => {
        const weapon_power = stats.weapon_power * (1 + stats.increased_weapon_power);
        const main_stat = stats.main_stat * (1 + stats.increased_main_stat);
        const base_ap = Math.sqrt((weapon_power * main_stat) / 6) * (1 + stats.base_ap);

        const info = supp_info[config.class as keyof typeof supp_info];
        const cooldown_multiplier =
            (1 / stats.cooldown_reduction) * (1 / (1 - stats.swift * cooldown_reduction_for_stat));
        const t_skill_cooldown_multiplier = 1 / stats.t_skill_cooldown_reduction;

        const window = 2;

        const t_uptime = Math.min(
            1,
            ((info.t_skill_duration - window) / info.t_skill_cooldown) *
                cooldown_multiplier *
                t_skill_cooldown_multiplier
        );
        const t_skill: Partial<Stats> = scale(
            { damage_multiplier: info.t_skill_effect * (1 + stats.outgoing_damage_effect) },
            t_uptime
        );

        const identity_effect =
            1 + stats.identity_effect + stats.spec * info.identity_effect_for_stat + stats.outgoing_damage_effect;
        const identity_gain = stats.identity_gain + stats.spec * info.identity_gain_for_stat;
        // + (config.class == "bard" ? 0.3 / (info.t_skill_cooldown * cooldown) : 0);

        const drops: Partial<Stats> = scale(
            {
                crit_rate: 0.15 / 6,
                increased_attack_power: 0.1 / 6,
            },
            stats.drops_effect
        );

        const generic_multipliers: Partial<Stats> = {
            damage_multiplier: stats.ally_outgoing_damage,
            crit_rate: stats.crit_rate_resistance,
            crit_damage: stats.crit_damage_resistance,
        };

        const identity_per_sec =
            info.identity_per_sec * (1 + identity_gain) * cooldown_multiplier +
            (info.awakening_bubbles / 300) * cooldown_multiplier * (1 / (1 - stats.awakening_cooldown)) +
            (stats.identity_for_casting_t / info.t_skill_cooldown) * cooldown_multiplier * t_skill_cooldown_multiplier;
        const identity_uptime = Math.min(1, identity_per_sec * info.base_duration);
        const identity: Partial<Stats> = scale(
            { damage_multiplier: info.base_effect * identity_effect },
            identity_uptime
        );

        const ap_buff_uptime = Math.min(1, ((14 - window) / 27) * cooldown_multiplier);
        const ap_buff: Partial<Stats> = scale(
            { increased_attack_power: 0.06, extra_ap: 0.15 * (1 + stats.ap_buff_effect) * base_ap },
            ap_buff_uptime
        );

        const reference = {
            ...reference_base_stats,
            crit_rate: 0.7,
            crit_damage: 2.5,
            evolution_damage: 0.5,
            increased_attack_power: 0.1, // adrenaline, elixir order, accessories
        };

        const brand: Partial<Stats> = { damage_multiplier: 0.1 * (1 + stats.brand_power) };

        const modified = [drops, identity, ap_buff, brand, t_skill, generic_multipliers].reduce(
            (prev: Stats, s) => applyNoLabel(prev, s),
            reference
        );

        const score =
            evalDps([{ stats: modified, weight: 1 }], false) - evalDps([{ stats: reference, weight: 1 }], false);
        return {
            weight,
            values: {
                score,
                base_ap,
                identity_uptime,
                t_uptime,
                ap_buff_uptime,
                identity_effect,
                t_skill_effect: info.t_skill_effect * (1 + stats.outgoing_damage_effect),
                ap_buff_effect: 1 + stats.ap_buff_effect,
                brand_power: 1 + stats.brand_power,
                drops_effect: stats.drops_effect,
                cooldown_reduction: 1 - 1 / cooldown_multiplier,
                identity_from_skills: info.identity_per_sec * (1 + identity_gain) * cooldown_multiplier,
                identity_from_t:
                    (stats.identity_for_casting_t / info.t_skill_cooldown) *
                    cooldown_multiplier *
                    t_skill_cooldown_multiplier,
                identity_from_awakening:
                    (info.awakening_bubbles / 300) * cooldown_multiplier * (1 / (1 - stats.awakening_cooldown)),
            },
        };
    });
    assert(Math.abs(weightedResults.reduce((prev, { weight }) => prev + weight, 0) - 1) < 0.001);

    const values = weightedResults.reduce(
        (prev, { weight, values }) =>
            Object.fromEntries(Object.entries(values).map(([key, value]) => [key, (prev[key] ?? 0) + weight * value])),
        {} as Record<string, number>
    ) as (typeof weightedResults)[0]["values"];

    return get_stats
        ? ({
            "Base Ap": values.base_ap.toFixed(0),
            "Identity Uptime": formatAsPercent(values.identity_uptime),
            "T Uptime": formatAsPercent(values.t_uptime),
            "AP Buff Uptime": formatAsPercent(values.ap_buff_uptime),
            "Identity Effect": formatAsPercent(values.identity_effect),
            "T Skill Effect": formatAsPercent(values.t_skill_effect),
            "AP Buff Effect": formatAsPercent(values.ap_buff_effect),
            "Brand Effect": formatAsPercent(values.brand_power),
            "Drops Effect": formatAsPercent(values.drops_effect),
            "Cooldown Reduction": formatAsPercent(values.cooldown_reduction),
            "Identity From Skills": formatAsPercent(values.identity_from_skills),
            "Identity From T": formatAsPercent(values.identity_from_t),
            "Identity From Awakening": formatAsPercent(values.identity_from_awakening),
        } as Record<string, string>)
        : values.score;
}

const systems = [
    "gear",
    "engraving",
    "stone",
    "elixir",
    "transcendence",
    "bracelet",
    "gems",
    "accessories",
    "enlightenment",
    "leap",
    "karma",
    "skins"
] as const;

type Config = {
    class: keyof typeof classes;
    type: "supp" | "dps";
};

type WeightedStats = { stats: Stats; weight: number }[];

function calculateBase(data: ReturnType<typeof scrape_data>, config: Config) {
    let base_stats: WeightedStats = [{ stats: reference_base_stats, weight: 1 }];

    base_stats = [
        ...data.loadout.loadout.arkPassive.evolution,
        ...data.loadout.loadout.arkPassive.enlightenment.filter(
            (e) => (ark_passive[e.id][5] == 1 || ark_passive[e.id][5] == 2) && ark_passive[e.id][4] != 3 // only main nodes (1-3)
        ),
    ]
        .flatMap((s) => {
            const effect = ark_passive[s.id][2];
            return Array.isArray(effect)
                ? effect.map((v) => ({ level: s.level, value: v }))
                : [{ level: s.level, value: effect }];
        })
        .reduce((prev: WeightedStats, s) => {
            if ("uptime" in s.value) {
                const scaled = scaleOrIndexUptimed(s.value, s.level);
                return [
                    ...prev.map(({ stats, weight }) => ({
                        stats: applyNoLabel(stats, scaled.stats),
                        weight: weight * scaled.uptime,
                    })),
                    ...prev.map(({ stats, weight }) => ({ stats, weight: weight * (1 - scaled.uptime) })),
                ];
            }
            const scaled = scaleOrIndex(s.value, s.level);
            return prev.map(({ stats, weight }) => ({ stats: applyNoLabel(stats, scaled), weight: weight }));
        }, base_stats);

    base_stats = data.loadout.loadout.engravings
        .map((e) => ({
            id: e.id,
            level: 0,
        }))
        .map((e) => scaledStat(engravings[e.id][2], e.level))
        .reduce((prev: WeightedStats, s) => {
            return prev.map(({ stats, weight }) => ({ stats: applyNoLabel(stats, s), weight: weight }));
        }, base_stats);

    return evalStats(base_stats, config);
}

function getStat(stat: { type: number; index: number; value: number }, system: (typeof systems)[number]) {
    if (stat.type == 2) {
        return label(scale(effect_for_base_stat[stats[stat.index]], stat.value), system, stats[stat.index]);
    } else if (stat.type == 3 || stat.type == 4) {
        if (special_effects[stat.index] == undefined) {
            return label(
                {},
                system,
                `Unknown Effect ${stat.index}`
            );
        }

        return label(
            special_effects[stat.index][1],
            system,
            special_effects[stat.index][0].replaceAll(/<[^>]*?>/g, "")
        );
    } else if (stat.type == 54) {
        return label(scale({ ap_buff_effect: 0.0001 }, stat.value), system, "Ally Atk. Power");
    } else if (stat.type == 59) {
        return label(scale({ outgoing_damage_effect: 0.0001 }, stat.value), system, "Ally Damage");
    } else if (stat.type == 29) {
        // 6000: 1.6%, 6001: 3.6%, 6002: 6%
        const value = [0.016, 0.036, 0.06][stat.index - 6000];
        return label({ identity_gain: value }, system, "Serenade, Piety, Harmony Meter Gain");
    }

    return undefined;
}

function getSystemsToApply(data: ReturnType<typeof scrape_data>, config: Config) {
    const increases: LabeledPartialStats[] = [];

    let base_stats: WeightedStats = [{ stats: reference_base_stats, weight: 1 }];
    increases.push(
        label(
            {
                weapon_power: data.weapon_power - reference_base_stats.weapon_power,
                main_stat: data.main_stat - reference_base_stats.main_stat,
                additional_damage: data.additional_damage - reference_base_stats.additional_damage,
            },
            "gear"
        )
    );

    base_stats = [
        ...data.loadout.loadout.arkPassive.evolution,
        ...data.loadout.loadout.arkPassive.enlightenment.filter(
            (e) => (ark_passive[e.id][5] == 1 || ark_passive[e.id][5] == 2) && ark_passive[e.id][4] != 3 // only main nodes (1-3)
        ),
    ]
        .flatMap((s) => {
            const effect = ark_passive[s.id][2];
            return Array.isArray(effect)
                ? effect.map((v) => ({ level: s.level, value: v }))
                : [{ level: s.level, value: effect }];
        })
        .reduce((prev: WeightedStats, s) => {
            if ("uptime" in s.value) {
                const scaled = scaleOrIndexUptimed(s.value, s.level);
                return [
                    ...prev.map(({ stats, weight }) => ({
                        stats: applyNoLabel(stats, scaled.stats),
                        weight: weight * scaled.uptime,
                    })),
                    ...prev.map(({ stats, weight }) => ({ stats, weight: weight * (1 - scaled.uptime) })),
                ];
            }
            const scaled = scaleOrIndex(s.value, s.level);
            return prev.map(({ stats, weight }) => ({ stats: applyNoLabel(stats, scaled), weight: weight }));
        }, base_stats);

    base_stats = data.loadout.loadout.engravings
        .map((e) => ({
            id: e.id,
            level: 0,
        }))
        .map((e) => scaledStat(engravings[e.id][2], e.level))
        .reduce((prev: WeightedStats, s) => {
            return prev.map(({ stats, weight }) => ({ stats: applyNoLabel(stats, s), weight: weight }));
        }, base_stats);

    increases.push(
        ...data.loadout.loadout.engravings
            .map((e) => ({
                id: e.id,
                level: e.grade == "engrave_grade05" ? 4 : e.grade == "engrave_grade04" ? Math.floor(e.progress / 5) : 0,
            }))
            .map((e) =>
                label(
                    reverse(scaledStat(engravings[e.id][2], e.level), scaledStat(engravings[e.id][2], 0)),
                    "engraving",
                    `${engravings[e.id][0]}: ${e.level * 5}/20`
                )
            )
    );

    increases.push(
        ...data.stone
            .filter((e) => stone_level[e.nodes] >= 1)
            .map((e) => {
                let effect = stone_effects[e.id];
                if (effect == null) {
                    // sometimes e.id is an engraving effect (T3 stone from event)
                    const realId = Object.entries(stone_effects).find(([_, values]) => values[0] == engravings[e.id][0]);
                    assert(realId);
                    effect = stone_effects[Number(realId[0])];
                }
                return label(
                    scaledStat(effect[2], stone_level[e.nodes] - 1),
                    "stone",
                    `${effect[0]}: ${e.nodes}`
                );
            })
    );

    if (data.stone.map((e) => stone_level[e.nodes]).reduce(sum, 0) >= 5) {
        increases.push(label({ base_ap: 0.015 }, "stone", "1.5% Base Ap"));
    }

    const elixir_points = data.loadout.elixirs
        .flatMap((elixir) => elixir.effects)
        .map((effect) => elixir_level[effect.points])
        .reduce(sum, 0);
    const effects = data.loadout.elixirs.flatMap((elixir) => elixir.effects);

    effects
        .filter((effect) => elixir_level[effect.points] >= 1)
        .filter((effect) => !(effect.id in elixir_names))
        .forEach(effect => {
            console.log("unrecognized elixir", effect.id);
        });
        

    increases.push(
        ...effects
            .filter((effect) => elixir_level[effect.points] >= 1 && effect.id in elixir_names)
            .map((effect) =>
                label(
                    scaledStat(
                        elixir_effects[elixir_names[effect.id as keyof typeof elixir_names]],
                        elixir_level[effect.points] - 1
                    ),
                    "elixir",
                    `${elixir_names[effect.id as keyof typeof elixir_names]}: ${elixir_level[effect.points]}`
                )
            )
    );
    const effect_names = effects.map((e) => elixir_names[e.id as keyof typeof elixir_names]);
    const chaosEffect = effect_names.find((e) => e.endsWith("(Chaos)"))?.replace(" (Chaos)", "");
    const orderEffect = effect_names.find((e) => e.endsWith("(Order)"))?.replace(" (Order)", "");
    if (elixir_points >= 35 && chaosEffect != undefined && chaosEffect == orderEffect) {
        increases.push(
            label(scaledStat(elixir_sets[chaosEffect], elixir_points >= 40 ? 1 : 0), "elixir", `${chaosEffect} ${elixir_points >= 40 ? 40 : 35} Set`)
        );
    }

    const transcendence_leaves = data.loadout.transcendences.flatMap((t) => t.leaves).reduce(sum, 0);
    increases.push(
        ...data.loadout.transcendences
            .map((t) => ({ slot: t.slot, level: t.leaves.reduce(sum, 0) }))
            .filter((t) => t.level >= 5)
            .map((t) =>
                label(
                    scale(
                        scaledStat(transcendence[t.slot], Math.floor(t.level / 5) - 1),
                        t.slot == "head" ? transcendence_leaves : 1
                    ),
                    "transcendence",
                    `${t.slot[0].toLocaleUpperCase()}${t.slot.substring(1)}`
                )
            )
    );

    increases.push(...data.bracelet.map((effect) => getStat(effect, "bracelet")).filter(Boolean));

    const base_ap = data.loadout.gems
        .map((g) => (g.effects.find((e) => stats[e.id] == "Basic Atk. Power")?.value ?? 0) / 10000)
        .reduce(sum, 0);
    increases.push(label({ base_ap }, "gems", "Base Ap"));

    // quite approximate
    const damage_distribution = [0.2357, 0.1772, 0.1315, 0.0783, 0.0544, 0.0308];
    const supp_identity_gain_effect = [
        /*top 2 gems are likely for ap buff*/ 0.02, 0.02, 0.3, 0.16, 0.13, 0.1, 0.07, 0.05,
    ];
    const supp_damage_gem_effect = {
        skill_attack_power_amplify_multiplier: [
            { ap_buff_effect: 1 * 0.67 }, // primary damage buff is 67% of uptime
            { ap_buff_effect: 1 * 0.33 },
        ],
        skill_group_attack_power_amplify_multiplier: [{ identity_effect: 1 }],
    } as const;
    const supp_damage_gem_effect_names = {
        skill_attack_power_amplify_multiplier: "Ap. Buff",
        skill_group_attack_power_amplify_multiplier: "Ident. Buff",
    } as const;

    if (config.type == "dps") {
        increases.push(
            ...data.loadout.gems
                .map((gem) => gem.effects.find((e) => gem_types[e.type] == "skill_damage"))
                .filter(Boolean)
                .map((effect) => effect.value / 10000)
                .sort((a, b) => b - a)
                .map((value, index) =>
                    label(
                        { damage_multiplier: (damage_distribution[index] ?? 0) * value },
                        "gems",
                        `Dmg +${(value * 100).toFixed(0)}%`
                    )
                )
        );
    } else {
        // TODO: gem on brand
        for (const effect_type of [
            "skill_attack_power_amplify_multiplier",
            "skill_group_attack_power_amplify_multiplier",
        ] as const) {
            increases.push(
                ...data.loadout.gems
                    .map((gem) => gem.effects.find((e) => gem_types[e.type] == effect_type))
                    .filter(Boolean)
                    .map((effect) => effect.value / 10000)
                    .sort((a, b) => b - a)
                    .map((value, index) =>
                        label(
                            scale(supp_damage_gem_effect[effect_type][index] ?? {}, value),
                            "gems",
                            `${supp_damage_gem_effect_names[effect_type]} +${(value * 100).toFixed(0)}%`
                        )
                    )
            );
        }
    }

    increases.push(
        ...data.loadout.gems
            .map((gem) => gem.effects.find((e) => gem_types[e.type] == "skill_cooldown_reduction"))
            .filter(Boolean)
            .map((effect) => effect.value / 10000)
            .sort((a, b) => b - a)
            .map((value, index) =>
                label(
                    {
                        cooldown_reduction:
                            ((config.type == "dps" ? damage_distribution : supp_identity_gain_effect)[index] ?? 0.03) *
                            value,
                    },
                    "gems",
                    `Cdr. -${(value * 100).toFixed(0)}%`
                )
            )
    );

    increases.push(
        ...data.accessories
            .flatMap((acc) => acc.stats)
            .filter((stat) => !(stat.type == 2 && (stat.index == 4 || stat.index == 5))) // type == 57 => enlightenment points?, ignore index 4, 5 (Dex, Int), only use 3 (Str) to not triple count main stat
            .map((effect) => getStat(effect, "accessories"))
            .filter(Boolean)
            .filter((s) => Object.keys(s[0]).length > 0)
    );

    if (config.type == "dps") {
        increases.push(
            ...data.loadout.loadout.arkPassive.enlightenment
                .filter(
                    (e) => ark_passive[e.id][5] == 0 || ark_passive[e.id][5] == 3 || ark_passive[e.id][4] == 3 // not main nodes (1-3)
                )
                .map((e) =>
                    label(
                        scale(
                            {
                                damage_multiplier:
                                    ark_passive[e.id][5] == 0 || ark_passive[e.id][5] == 3 ? 0.013 : 0.07,
                            },
                            e.level
                        ),
                        "enlightenment",
                        ark_passive[e.id][0]
                    )
                )
        );
    } else {
        // artist enlightenment row 4 nodes grants 5% identity refunds calculated as 5% cooldown reduction, assume bard and paladin gain similar uptime improvement
        increases.push(
            ...data.loadout.loadout.arkPassive.enlightenment
                .filter((e) => ark_passive[e.id][4] == 3 && (ark_passive[e.id][5] == 1 || ark_passive[e.id][5] == 2))
                .map((e) => label(scale({ cooldown_reduction: 0.05 }, e.level), "enlightenment", ark_passive[e.id][0]))
        );
    }

    if (config.type == "dps") {
        increases.push(
            ...data.loadout.loadout.arkPassive.leap
                .filter(
                    (e) => ark_passive[e.id][4] == 1 // 2. row
                )
                .map((e) => label(scale({ damage_multiplier: 0.03 }, e.level), "leap", ark_passive[e.id][0]))
        );
    } else {
        const effect = {
            bard: { identity_for_casting_t: 0.1 },
            holyknight: { identity_for_casting_t: 0.06 },
            yinyangshi: { t_skill_cooldown_reduction: 0.05 },
        } as Record<keyof typeof classes, Partial<Stats>>;

        increases.push(
            ...data.loadout.loadout.arkPassive.leap
                .filter(
                    (e) => ark_passive[e.id][4] == 1 // 2. row
                )
                .map((e) => label(scale(effect[config.class], e.level), "leap", ark_passive[e.id][0]))
        );
    }

    for (const tree of ["evolution", "enlightenment", "leap"] as const) {
        increases.push(
            label(
                merge(
                    scale(karma_rank_effects[tree], data.karma[tree].rank),
                    scale(karma_level_effects[tree], data.karma[tree].level)
                ),
                "karma",
                `${tree[0].toLocaleUpperCase()}${tree.substring(1)}`
            )
        );
    }
    for (const skin of data.skins) {
        const slot_names = {
            "avatar_weapon": "Weapon",
            "avatar_head": "Head",
            "avatar_upper_body": "Body",
            "avatar_lower_body": "Pants"
        };
        const effect = skins.find(s => s.id == skin.id)!;
        increases.push(label({ increased_main_stat: effect.main_stat_increase / 10_000}, "skins", slot_names[skin.slot]));
    }

    for (const inc of increases) {
        if (Object.values(inc[0]).some(isNaN)) {
            throw new Error(`Invalid stats: ${JSON.stringify(inc[0])} from ${inc[1]} ${inc[2]}`);
        }
    }
    for (const inc of increases) {
        if ((inc[0].crit_rate ?? 0) > 0) {
            console.log(`Krit +${(inc[0].crit_rate! * 100)}%`, inc[1]);
        }
    }

    return [base_stats, increases] as const;
}

function deepCopy<T>(obj: T) {
    return JSON.parse(JSON.stringify(obj)) as T;
}

function suggestedIncreases(data: ReturnType<typeof scrape_data>, config: Config) {
    function evalS(base_stats: WeightedStats, effects: LabeledPartialStats[]) {
        const final_stats = base_stats.map(({ stats, weight }) => ({
            stats: effects.reduce((prev, s) => applyNoLabel(prev, s[0]), stats),
            weight,
        }));
        return evalStats(final_stats, config, false);
    }

    function stats(base_stats: WeightedStats, effects: LabeledPartialStats[]) {
        const final_stats = base_stats.map(({ stats, weight }) => ({
            stats: effects.reduce((prev, s) => applyNoLabel(prev, s[0]), stats),
            weight,
        }));
        return final_stats;
    }
    const full = evalS(...getSystemsToApply(data, config));

    const suggestedIncreases: [typeof systems[number], string, number][] = [];

    // evolution
    const oldEvolution = deepCopy(data.loadout.loadout.arkPassive.evolution);
    for (let row = 0; row < 3; row++) {
        const current = data.loadout.loadout.arkPassive.evolution.filter((e) => ark_passive[e.id][4] == row);
        for (const point_to_replace of current) {
            assert(point_to_replace.level > 0);
            const ark_passive_data = ark_passive[point_to_replace.id];

            if (ark_passive_data[0] == "Specialization") {
                continue;
            }

            point_to_replace.level = point_to_replace.level - 1;
            for (let col = 0; col < 6; col++) {
                if (ark_passive_data[5] == col) {
                    continue;
                }
                const replacement = Number(
                    Object.entries(ark_passive).find(([_key, e]) => e[4] == row && e[5] == col)![0]
                );
                data.loadout.loadout.arkPassive.evolution = [
                    ...data.loadout.loadout.arkPassive.evolution.filter((e) => e.id != point_to_replace.id),
                    point_to_replace,
                    {
                        level: 1,
                        id: replacement,
                    },
                ];

                const increase = evalS(...getSystemsToApply(data, config)) / full;
                data.loadout.loadout.arkPassive.evolution = deepCopy(oldEvolution);

                if (increase > 1) {
                    suggestedIncreases.push(["gear", `${ark_passive_data[0]}->${ark_passive[replacement][0]}`, increase]);
                }
            }
        }
    }
    // elixir
    const idFromName = new Map(Object.entries(elixir_names).map(([key, value]) => [value, Number(key)]));
    const oldElixirs = data.loadout.elixirs;
    type Elixir = (typeof data.loadout.elixirs)[number];
    type Effect = Elixir["effects"][number];
    const tryReplacement = (
        name: string,
        ...replacements: { elixir: Elixir; oldEffect: Effect; newEffect: Effect }[]
    ) => {
        data.loadout.elixirs = [
            ...data.loadout.elixirs.filter((e) => !replacements.find(({ elixir }) => elixir == e)),
            ...replacements.map(({ elixir, oldEffect, newEffect }) => ({
                ...elixir,
                effects: [...elixir.effects.filter((e) => e != oldEffect), newEffect],
            })),
        ];

        const after = evalS(...getSystemsToApply(data, config));
        // const stats_after = stats(...getSystemsToApply(data, config));

        data.loadout.elixirs = oldElixirs;
        const before = full;
        //   const stats_before = stats(...getSystemsToApply(data, config));

        if (after / before > 1) {
            suggestedIncreases.push(["elixir", name, after / before]);
        }
    };

    for (const elixir of data.loadout.elixirs) {
        for (const effect of elixir.effects) {
            const slot = elixir.slot;

            const name = elixir_names[effect.id as keyof typeof elixir_names];

            for (const common_effect of ["Strength", "Weapon Power", "Atk. Power"] as const) {
                const replacement = {
                    id: idFromName.get(common_effect)!,
                    points: 10,
                };

                tryReplacement(`${name} ${elixir_level[effect.points]}->${common_effect} ${elixir_level[replacement.points]}`, {
                    elixir,
                    oldEffect: effect,
                    newEffect: replacement,
                });
            }
            if (!common_elixir_effects.has(name) && slot != "head" && slot != "hand") {
                const replacements = {
                    shoulder: ["Boss Damage"],
                    upper_body: [],
                    lower_body: ["Crit Damage", "Additional Damage"],
                } as const;
                for (const replacementName of replacements[slot]) {
                    const replacement = {
                        id: idFromName.get(replacementName)!,
                        points: 10,
                    };
                    tryReplacement(
                        `${name} ${elixir_level[effect.points]}->${replacementName} ${
                            elixir_level[replacement.points]
                        }`,
                        { elixir, oldEffect: effect, newEffect: replacement }
                    );
                }
            }
        }
    }
    // set
    const headElixir = data.loadout.elixirs.find((e) => e.slot == "head")!;
    const handElixir = data.loadout.elixirs.find((e) => e.slot == "hand")!;
    const headSpecial =
        headElixir?.effects.find((e) => !common_elixir_effects.has(elixir_names[e.id as keyof typeof elixir_names])) ??
        headElixir.effects[0];
    const handSpecial =
        handElixir?.effects.find((e) => !common_elixir_effects.has(elixir_names[e.id as keyof typeof elixir_names])) ??
        handElixir.effects[0];
    for (const setName of ["Critical", "Master"] as const) {
        const newHead = {
            id: idFromName.get(`${setName} (Order)`)!,
            points: headSpecial.points,
        };
        const newHand = {
            id: idFromName.get(`${setName} (Chaos)`)!,
            points: handSpecial.points,
        };
        tryReplacement(
            `Set ${setName}`,
            { elixir: headElixir, oldEffect: headSpecial, newEffect: newHead },
            { elixir: handElixir, oldEffect: handSpecial, newEffect: newHand }
        );
    }

    // accesories
    for(let i = 0; i < 3; i++) {
        const old = data.accessories[0].stats;
        data.accessories[0].stats = [...old, {
            type: 29,
            index: 6000 + i,
            base: true,
            id: 0,
            value: 0
        }];
        const after = evalS(...getSystemsToApply(data, config));

        data.accessories[0].stats = old;

        if (after / full > 1) {
            suggestedIncreases.push(["elixir", `Serenade, Piety, Harmony Meter Gain ${formatAsPercent([0.016, 0.036, 0.06][i])}`, after / full]);
        }
    }
    

    return suggestedIncreases;
}

function calculate(data: ReturnType<typeof scrape_data>, config: Config) {
    const [base_stats, increases] = getSystemsToApply(data, config);

    function evalS(effects: LabeledPartialStats[]) {
        return evalStats(
            base_stats.map(({ stats, weight }) => ({
                stats: effects.reduce((prev, s) => applyNoLabel(prev, s[0]), stats),
                weight,
            })),
            config,
            false
        );
    }
    const full = evalS(increases);
    return [
        full,
        systems.map((s) => ({
            system: s,
            gain: full / evalS(increases.filter((e) => e[1] != s)) - 1,
        })),
    ] as const;
}

function calculateDetailed(data: ReturnType<typeof scrape_data>, config: Config) {
    const [base_stats, increases] = getSystemsToApply(data, config);

    function evalS(effects: LabeledPartialStats[]) {
        return evalStats(
            base_stats.map(({ stats, weight }) => ({
                stats: effects.reduce((prev, s) => applyNoLabel(prev, s[0]), stats),
                weight,
            })),
            config,
            false
        );
    }
    const full = evalS(increases);
    return [
        full,
        systems.map((s) => ({
            system: s,
            gain: full / evalS(increases.filter((e) => e[1] != s)) - 1,
            detail: increases
                .filter((e) => e[1] == s && e[2] != undefined)
                .map((e) => [e[2]!, full / evalS(increases.filter((other) => other != e)) - 1] as const),
        })),
    ] as const;
}
function calculate_stats(data: ReturnType<typeof scrape_data>, config: Config) {
    const [base_stats, increases] = getSystemsToApply(data, config);
    return evalStats(
        base_stats.map(({ stats, weight }) => ({
            stats: increases.reduce((prev, s) => applyNoLabel(prev, s[0]), stats),
            weight,
        })),
        config,
        true
    );
}

const most_recent_searches = new Map<
    string,
    [region: string, character: string, info: [keyof typeof classes, number]][]
>();

register_command(
    new SlashCommand()
        .setDescription("Get character Informater")
        .setName("lookup_char")
        .addStringOption((e) =>
            e
                .setDescription("Region")
                .setName("region")
                .setRequired(true)
                .addChoices(
                    { name: "Central Europe", value: "CE" },
                    { name: "North America West", value: "NAW" },
                    { name: "North America East", value: "NAE" }
                )
        )
        .addStringOption((e) =>
            e
                .setDescription("Character Name")
                .setName("name")
                .setMinLength(1)
                .setMaxLength(20)
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addBooleanOption((e) => e.setDescription("Detailed damage contribution").setName("detailed"))
        .addBooleanOption((e) => e.setDescription("Print final stats instead").setName("stats"))
        .addBooleanOption((e) => e.setDescription("Print suggestions instead").setName("suggest")),
    async (i) => {
        const region = i.options.getString("region", true);
        const character = i.options.getString("name", true);
        const stats = i.options.getBoolean("stats", false) ?? false;
        const suggest = i.options.getBoolean("suggest", false) ?? false;
        const raw_data = await fetch_data(character, region);
        const detailed = i.options.getBoolean("detailed", false) ?? false;

        if ("error" in raw_data) {
            console.log(raw_data.error);
            i.reply({
                content: "Something went Wrong / Character not Found",
            });
            return;
        }

        try {
            const char_class = raw_data.data[1]!.data.header!.class as keyof typeof classes;
            const ivl = raw_data.data[1]!.data.header!.ilvl;
            const type =
                char_class == "bard" || char_class == "holyknight" || char_class == "yinyangshi" ? "supp" : "dps";

            most_recent_searches.set(i.user.id, [
                [region, character, [char_class, ivl]],
                ...(most_recent_searches.get(i.user.id) ?? [])
                    .filter((e) => e[1] != character || e[0] != region)
                    .slice(0, 4),
            ]);

            const config: Config = { class: char_class, type };
            console.log(character);
            const data = scrape_data(raw_data);

            if (stats) {
                const stats = calculate_stats(data, config);
                await i.reply({
                    content: `Character: \`${character}\` <t:${Math.floor(
                        data.loadout.lastUpdated / 1000
                    )}:R>\n${Object.entries(stats)
                        .map(([key, value]) => `${key}: \`${value}\``)
                        .join("\n")}`,
                });
                return;
            }

            if (suggest) {
                const suggestions = suggestedIncreases(data, config);
                const systemsPresent = suggestions.map(s => s[0]).reduce((prev, s) => prev.includes(s) ? prev : [...prev, s], [] as typeof systems[number][]);
                await i.reply({
                    content: `Character: \`${character}\` <t:${Math.floor(
                        data.loadout.lastUpdated / 1000
                    )}:R>\n${systemsPresent
                        .map((system) => 
                            `${system[0].toUpperCase() + system.substring(1)}: \n`
                            + suggestions
                                .filter((s) => s[0] == system)
                                .map(([_, name, value]) => `\t${name}: \`${formatAsPercent(value-1)}\``)
                                .join("\n")
                        ).join("\n")}`,
                });
                return;
            }


          

            if (!detailed) {
                const [full, bySystem] = calculate(data, config);
                const score = ((100 * full) / calculateBase(data, config)).toFixed(0);

                await i.reply({
                    content: `Character: \`${character}\` <t:${Math.floor(
                        data.loadout.lastUpdated / 1000
                    )}:R>\nScore: \`${score}\`\nDamage gain:\n${bySystem
                        .map(
                            ({ system, gain }) =>
                                `\t${system[0].toUpperCase() + system.substring(1)}: \`${formatAsPercent(
                                    Math.max(0, gain)
                                )}\``
                        )
                        .join("\n")}`,
                });
            } else {
                const [full, bySystem] = calculateDetailed(data, config);
                const score = ((100 * full) / calculateBase(data, config)).toFixed(0);

                await i.reply({
                    content: `Character: \`${character}\` <t:${Math.floor(
                        data.loadout.lastUpdated / 1000
                    )}:R>\nScore: \`${score}\`\nDamage gain:\n${bySystem
                        .map(
                            ({ system, gain, detail }) =>
                                `\t${system[0].toUpperCase() + system.substring(1)}: \`${formatAsPercent(
                                    Math.max(0, gain)
                                )}\`\n` +
                                detail
                                    .sort((a, b) => b[1] - a[1])
                                    .filter((a) => a[1] > 0)
                                    .map((detail) => {
                                        let name = detail[0].replaceAll("\n", "");
                                        name = name.length > 70 ? name.substring(0, 67) + "..." : name;
                                        return `\t\t${name}: \`${formatAsPercent(Math.max(0, detail[1]))}\``;
                                    })
                                    .join("\n")
                        )
                        .join("\n")}`,
                });
            }
        } catch (error) {
            console.log(error);
            i.reply({
                content: "Something went Wrong / Character not Found",
            }).catch((_) => {});
            return;
        }
    },
    async (i) => {
        const region = i.options.getString("region");
        if (region == null || region.length < 2) {
            return;
        }
        const value = i.options.getFocused();
        if (value.length < 3) {
            const searches = most_recent_searches.get(i.user.id);
            if (searches == undefined) {
                return;
            }
            i.respond(
                searches
                    .filter((e) => e[0] == region)
                    .map((option) => ({
                        value: option[1],
                        name: `${option[1]} - ${classes[option[2][0]]} (${option[2][1].toFixed(2)})`,
                    }))
            ).catch((_) => {});
            return;
        }
        const res = await fetch(
            `https://uwuowo.mathi.moe/api/search?region=${encodeURIComponent(region)}&name=${encodeURIComponent(value)}`
        );
        const body = (await res.json()) as [string, keyof typeof classes, number][];
        i.respond(
            body.map((option) => ({
                value: option[0],
                name: `${option[0]} - ${classes[option[1]]} (${option[2].toFixed(2)})`,
            }))
        ).catch((_) => {});
    }
);
// collect_by_prefix("https://uwuowo.mathi.moe/character/"
/*collect(async (msg) => {
    
    const data = [...msg.content.matchAll(/https:\/\/uwuowo\.mathi\.moe\/character\/(\w+)\/([^\s/]+)/g)].map(async (match) => {
        const region = match[1];
        const character = decodeURIComponent(match[2]);
        const raw_data = await fetch_data(character, region);

        if("error" in raw_data) {
            console.log(raw_data.error);
            return;
        }

        try {
            const char_class = raw_data.data[1]!.data.header!.class as keyof typeof classes;
            const type = char_class == "bard" || char_class == "holyknight" || char_class == "yinyangshi"  ? "supp" : "dps";
    
            const config: Config = { class: char_class, type };
    
            const data = scrape_data(raw_data);

    
           
            const [full, bySystem] = calculate(data, config);
            const score = (100 * full / calculateBase(data, config)).toFixed(0);

            return `Character: \`${character}\` <t:${Math.floor(data.loadout.lastUpdated / 1000)}:R>\tScore: \`${score}\``;
        } catch (error) {
            return `Character: \`${character}\` Not Found`;
            console.log(error);
            return;
        }
    });
    if(data.length == 0) {
        return;
    }
    const result = await Promise.all(data);
    msg.reply({ 
        content: result.filter(Boolean).join("\n")
    }).catch(_ => {});
    
});*/
