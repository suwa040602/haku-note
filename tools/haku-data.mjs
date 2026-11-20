// 箔：レシピ元データ（data/recipes.enc）の暗号化・復号ツール
// 鍵は .haku-key（git管理外）に置く。アプリと同じ AES-GCM 256bit・iv 12byte・{v,iv,ct} 形式。
//   node tools/haku-data.mjs keygen            鍵を作る（既にあれば何もしない）
//   node tools/haku-data.mjs decrypt [out]     data/recipes.enc → data/recipes.json
//   node tools/haku-data.mjs encrypt [in]      data/recipes.json → data/recipes.enc
//   node tools/haku-data.mjs link              スマホで開く鍵付きリンクを表示
import { webcrypto as crypto } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEY_FILE = path.join(ROOT, '.haku-key');
const ENC = path.join(ROOT, 'data', 'recipes.enc');
const PLAIN = path.join(ROOT, 'data', 'recipes.json');
const SITE = 'https://suwa040602.github.io/haku-note/';

const readKey = () => fs.readFileSync(KEY_FILE, 'utf8').trim();
const keyObj = () => crypto.subtle.importKey('raw', Buffer.from(readKey(), 'base64url'), 'AES-GCM', false, ['encrypt', 'decrypt']);

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'keygen') {
  if (fs.existsSync(KEY_FILE)) { console.log('鍵は既にあります'); process.exit(0); }
  fs.writeFileSync(KEY_FILE, Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url'));
  console.log('鍵を作りました');
} else if (cmd === 'decrypt') {
  const o = JSON.parse(fs.readFileSync(ENC, 'utf8'));
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(o.iv, 'base64') }, await keyObj(), Buffer.from(o.ct, 'base64'));
  fs.writeFileSync(arg || PLAIN, JSON.stringify(JSON.parse(Buffer.from(pt).toString('utf8')), null, 1));
  console.log('復号しました →', arg || PLAIN);
} else if (cmd === 'encrypt') {
  const doc = JSON.parse(fs.readFileSync(arg || PLAIN, 'utf8'));
  doc.updatedAt = Date.now();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyObj(), Buffer.from(JSON.stringify(doc), 'utf8'));
  fs.mkdirSync(path.dirname(ENC), { recursive: true });
  fs.writeFileSync(ENC, JSON.stringify({ v: 1, iv: Buffer.from(iv).toString('base64'), ct: Buffer.from(ct).toString('base64') }));
  console.log(`暗号化しました → ${ENC}（レシピ${doc.recipes.length}・コース${doc.courses.length}）`);
} else if (cmd === 'link') {
  console.log(`${SITE}#k=${readKey()}`);
} else {
  console.log('使い方: keygen | decrypt [out] | encrypt [in] | link');
}
