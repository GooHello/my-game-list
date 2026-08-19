/**
 * 封面图压缩脚本：npm run compress-covers [-- --threshold=200 --dry-run]
 *
 * 策略（精准手术，不盲目批量）：
 * - 只处理超过阈值（默认 200KB）的封面，小图不动
 * - 缩放到宽度 ≤600px（卡片实际显示尺寸的 2 倍，不放大）
 * - JPEG 质量 80 重编码，保持 .jpg 扩展名不变（cover 路径无需更新）
 * - 已提交 git，任何时候可回滚：git checkout -- public/covers/
 *
 * 参数：
 *   --threshold=200  体积阈值 KB（默认 200）
 *   --dry-run        只报告预期效果，不写文件
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const COVERS_DIR = path.join(__dirname, '..', 'public', 'covers');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const thresholdArg = args.find(a => a.startsWith('--threshold='));
const THRESHOLD_KB = thresholdArg ? parseInt(thresholdArg.split('=')[1]) : 200;
const MAX_WIDTH = 600;
const QUALITY = 80;

async function main() {
  const files = fs.readdirSync(COVERS_DIR).filter(f => f.toLowerCase().endsWith('.jpg'));
  const targets = [];
  for (const f of files) {
    const size = fs.statSync(path.join(COVERS_DIR, f)).size;
    if (size > THRESHOLD_KB * 1024) targets.push({ f, size });
  }

  console.log(`📊 共 ${files.length} 张封面，超过 ${THRESHOLD_KB}KB 的有 ${targets.length} 张`);
  if (targets.length === 0) {
    console.log('✅ 无需压缩');
    return;
  }
  if (dryRun) console.log('（dry-run 模式：只报告，不写文件）\n');

  let saved = 0;
  for (const { f, size } of targets.sort((a, b) => b.size - a.size)) {
    const filePath = path.join(COVERS_DIR, f);
    try {
      const buffer = await sharp(filePath)
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: QUALITY, progressive: true })
        .toBuffer();

      const kb = n => (n / 1024).toFixed(0) + 'KB';
      if (buffer.length >= size) {
        console.log(`  ⏭️  ${f}: ${kb(size)} → 压缩后反而更大(${kb(buffer.length)})，跳过`);
        continue;
      }
      if (!dryRun) {
        // 先写临时文件再原子替换，避免 Windows 上 sharp 读句柄未释放时直接覆盖失败
        const tmpPath = filePath + '.tmp';
        fs.writeFileSync(tmpPath, buffer);
        let renamed = false;
        for (let i = 0; i < 3 && !renamed; i++) {
          try {
            fs.renameSync(tmpPath, filePath);
            renamed = true;
          } catch (e) {
            if (i === 2) throw e;
            await new Promise(r => setTimeout(r, 200));
          }
        }
      }
      saved += size - buffer.length;
      console.log(`  ${dryRun ? '🔍' : '✅'} ${f}: ${kb(size)} → ${kb(buffer.length)}`);
    } catch (e) {
      console.error(`  ❌ ${f}: ${e.message}`);
    }
  }

  console.log(`\n${dryRun ? '预计' : '实际'}节省: ${(saved / 1024 / 1024).toFixed(2)}MB`);
}

main().catch(e => {
  console.error('❌ 失败:', e.message);
  process.exit(1);
});
