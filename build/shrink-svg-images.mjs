// build/shrink-svg-images.mjs
// フロアマップ SVG（Figma 書き出し）の埋め込み画像を「実際の表示サイズ × 最大拡大率」まで縮小する
// Usage: node build/shrink-svg-images.mjs <input.svg> <output.svg> [maxZoom=4]
//
// Figma はロゴ等の画像を元の解像度のまま埋め込むため、51×27 の区画に 962×512 の画像が入っているような
// 状態になり、マップの拡大縮小・フロア切替の描画とメモリの負荷が大きい。
// 図形（path 等）と画像の配置・見た目の大きさは変えず、埋め込み画像のビットマップだけを縮小する。
// - 最大拡大率（maxZoom）で表示しても元と同じ見え方になるサイズまでしか縮小しない
// - 縮小済みの画像はそれ以上縮小しない（再実行しても劣化しない）
// - 必要: ImageMagick（magick コマンド）
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const [, , input, output, zoomArg] = process.argv;
if (!input || !output) {
  console.error('Usage: node build/shrink-svg-images.mjs <input.svg> <output.svg> [maxZoom=4]');
  process.exit(1);
}
const MAX_ZOOM = Number(zoomArg ?? 4);
const svg = readFileSync(input, 'utf8');

const attr = (s, n) => { const m = s.match(new RegExp(`\\b${n}="([^"]+)"`)); return m ? m[1] : null; };

// パスの外接矩形（Figma は絶対座標コマンドのみ出力する。曲線の制御点も含めるので実際より少し大きめ＝安全側）
function pathBBox(d) {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  let cmd = '', expectX = true;
  const xs = [], ys = [];
  for (const t of tokens) {
    if (/[A-Za-z]/.test(t)) {
      if (t !== t.toUpperCase() && t !== 'z') throw new Error(`relative path command not supported: ${t}`);
      cmd = t; expectX = true; continue;
    }
    const v = Number(t);
    if (cmd === 'H') xs.push(v);
    else if (cmd === 'V') ys.push(v);
    else if (cmd === 'A') throw new Error('arc path command not supported');
    else { (expectX ? xs : ys).push(v); expectX = !expectX; }
  }
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

// 埋め込み画像: id -> 属性上のサイズ（配置用。縮小後も変えない）とデータ
const images = new Map();
for (const m of svg.matchAll(/<image id="([^"]+)" width="([\d.]+)" height="([\d.]+)"[^>]*xlink:href="data:image\/(png|jpeg);base64,([^"]+)"/g)) {
  images.set(m[1], { w: +m[2], h: +m[3], fmt: m[4], b64: m[5], needW: 0, needH: 0, used: false });
}

// パターン: id -> 画像と、画像 1単位が要素の外接矩形の何倍で表示されるか（objectBoundingBox）
const patterns = new Map();
for (const m of svg.matchAll(/<pattern id="([^"]+)"([^>]*)>\s*<use xlink:href="#([^"]+)"([^>]*)\/>/g)) {
  if (attr(m[2], 'patternContentUnits') !== 'objectBoundingBox') throw new Error(`unsupported pattern: ${m[1]}`);
  const tf = attr(m[4], 'transform') ?? '';
  if (/rotate|skew/.test(tf)) throw new Error(`unsupported pattern transform: ${m[1]}`);
  // matrix / translate / scale の線形部分を合成する（translate は大きさに影響しない）
  let [a, b, c, d] = [1, 0, 0, 1];
  for (const t of tf.matchAll(/(matrix|translate|scale)\(([^)]+)\)/g)) {
    const v = t[2].trim().split(/[\s,]+/).map(Number);
    let n;
    if (t[1] === 'matrix') n = v.slice(0, 4);
    else if (t[1] === 'scale') n = [v[0], 0, 0, v[1] ?? v[0]];
    else continue;
    [a, b, c, d] = [a * n[0] + c * n[1], b * n[0] + d * n[1], a * n[2] + c * n[3], b * n[2] + d * n[3]];
  }
  patterns.set(m[1], { imageId: m[3], sx: Math.hypot(a, b), sy: Math.hypot(c, d) });
}

// 画像で塗っている要素ごとに、画像が最大拡大率で何 px 必要かを求める（同じ画像の複数使用は最大値）
for (const m of svg.matchAll(/<(rect|path)\b([^>]*?)fill="url\(#([^)]+)\)"([^>]*)\/?>/g)) {
  const a = m[2] + m[4];
  const p = patterns.get(m[3]);
  if (!p) continue;
  // 要素の rotate / translate は大きさを変えないので許容。拡大縮小を伴う transform は未対応
  if (/\btransform="[^"]*(scale|matrix|skew)/.test(a)) throw new Error(`scaled element not supported (pattern ${m[3]})`);
  const img = images.get(p.imageId);
  if (!img) throw new Error(`image not found: ${p.imageId}`);
  const bb = m[1] === 'rect' ? { w: +attr(a, 'width'), h: +attr(a, 'height') } : pathBBox(attr(a, 'd'));
  img.used = true;
  img.needW = Math.max(img.needW, img.w * p.sx * bb.w * MAX_ZOOM);
  img.needH = Math.max(img.needH, img.h * p.sy * bb.h * MAX_ZOOM);
}

const magick = (args, input) => execFileSync('magick', args, { input, maxBuffer: 1 << 28 });

let out = svg;
const report = [];
for (const [id, img] of images) {
  const before = Buffer.from(img.b64, 'base64');
  const kb = n => Math.round(n / 1024);
  // 用途が判定できない画像（パターン以外での使用など）は触らない
  if (!img.used) { report.push({ id, bitmap: '-', to: '(対象外)', kb: kb(before.length) }); continue; }
  const f = img.fmt === 'jpeg' ? 'jpeg' : 'png';
  // 実際のビットマップのサイズ（縮小済みなら属性のサイズより小さい）
  const [bw, bh] = magick([`${f}:-`, '-format', '%w %h', 'info:'], before).toString().trim().split(' ').map(Number);
  const scale = Math.max(img.needW / bw, img.needH / bh);
  if (scale >= 0.95) { report.push({ id, bitmap: `${bw}x${bh}`, to: '(そのまま)', kb: kb(before.length) }); continue; }
  const tw = Math.max(1, Math.ceil(bw * scale)), th = Math.max(1, Math.ceil(bh * scale));
  const opts = f === 'jpeg' ? ['-quality', '92'] : ['-define', 'png:compression-level=9'];
  const after = magick([`${f}:-`, '-filter', 'Lanczos', '-resize', `${tw}x${th}!`, '-strip', ...opts, `${f}:-`], before);
  if (after.length >= before.length) { report.push({ id, bitmap: `${bw}x${bh}`, to: '(小さくならないため据え置き)', kb: kb(before.length) }); continue; }
  // <image width/height> は変えない（ビットマップは属性のサイズに合わせて表示されるので、配置・大きさは変わらない）
  out = out.replace(img.b64, after.toString('base64'));
  report.push({ id, bitmap: `${bw}x${bh}`, to: `${tw}x${th}`, kb: `${kb(before.length)}→${kb(after.length)}` });
}

writeFileSync(output, out);
if (report.length > 0) console.table(report);
console.log(`${(svg.length / 1048576).toFixed(2)}MB -> ${(out.length / 1048576).toFixed(2)}MB (maxZoom=${MAX_ZOOM})`);
