#!/usr/bin/env node
// 사용법: npm run new-demo -- <카테고리 폴더> <데모 폴더>
//   예) npm run new-demo -- 05-lights 02-rect-area-light
// 카테고리 폴더가 없으면 category.js도 함께 만든다.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [cat, demo] = process.argv.slice(2);
if (!cat || !demo || !/^\d+-/.test(cat) || !/^\d+-/.test(demo)) {
  console.error('사용법: npm run new-demo -- <NN-category> <NN-demo>   (숫자 접두사 필수)');
  process.exit(1);
}
const catDir = join(root, 'src/demos', cat);
const demoDir = join(catDir, demo);
if (existsSync(demoDir)) {
  console.error(`이미 존재합니다: ${demoDir}`);
  process.exit(1);
}
if (!existsSync(join(catDir, 'category.js'))) {
  mkdirSync(catDir, { recursive: true });
  writeFileSync(
    join(catDir, 'category.js'),
    `export default {\n  title: '${cat.replace(/^\d+-/, '')}',\n  en: '',\n  intro: '<p>카테고리 소개</p>',\n};\n`,
  );
  console.log(`카테고리 생성: src/demos/${cat}/category.js`);
}
cpSync(join(root, 'scripts/demo-template'), demoDir, { recursive: true });
console.log(`데모 생성: src/demos/${cat}/${demo}/ (meta.js, content.html, demo.js)`);
