// public/ の ファイルを 置き場所ごと 指す。
// 開発中は "/"、GitHub Pages では "/mini-piyofit/" の 下に 置かれる
export const asset = (path: string) => import.meta.env.BASE_URL + path.replace(/^\//, "");
