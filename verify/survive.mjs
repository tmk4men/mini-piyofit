import * as R from "./rules.mjs";
const H = R.HOUR, T0 = 1_800_000_000_000;
const base = R.addReps(R.newPet(1, T0), 10, T0).pet;
// 何時間 ほうっておくと いえでするか（はじめの状態ごと）
const until = (p) => { for (let h = 1; h < 200; h++) if (R.tick(p, T0 + h * H).ending) return h; return ">200"; };
console.log("満タン・うんちなし:", until({ ...base, hunger: 100, mood: 100, poops: 0, poopClock: 0 }), "h");
console.log("満タン・うんち3こ:", until({ ...base, hunger: 100, mood: 100, poops: 3 }), "h");
console.log("ハート半分(50/50):", until({ ...base, hunger: 50, mood: 50 }), "h");
console.log("ハート1こ(20/20):", until({ ...base, hunger: 20, mood: 20, poops: 2 }), "h");
