# ミニぴよふぃっと

いっしょに うごくと ぴよこが そだつ、ちいさな育成ゲーム。ブラウザで遊べます。

- カメラの前で スクワット か うでたて をすると、そだって コインがもらえる
- コインで ごはんを かって たべさせる。うんちは そうじ
- おでかけ（1日3回）：おじいちゃんの いえ / だがしや / はらっぱ（しょうがいぶつ きょうそう）/ おとなになると であいの おうち
- 400回で おとな。けっこん か ひとりだちで 次の世代へ
- おなか か きげんが 0 になると いえで

## うごかす

```
npm install
npm run dev
```

カメラは HTTPS か localhost でだけ使えます。姿勢の判定（MediaPipe）は `public/mediapipe` に同梱していて、端末の中で動きます。映像はどこにも送りません。

## テスト

```
npx esbuild src/game/rules.ts --format=esm --outfile=verify/rules.mjs
npx esbuild src/game/economy.ts --format=esm --outfile=verify/economy.mjs
sed -i 's#from "./rules"#from "./rules.mjs"#' verify/economy.mjs
node verify/rules.test.mjs
```
