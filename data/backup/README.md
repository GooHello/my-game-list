# 备份目录说明

> ⚠️ **恢复备份前请先阅读**

## 当前备份时间线

| 文件 | 时间 | 说明 |
|------|------|------|
| games_Backup.json | 2026-03 早期 | 最旧备份，**仅 13 字段（无 remark）**，恢复会丢失备注 |
| games_backup_20260330.json | 2026-03-30 | 手游聚类尝试前的备份 |
| games_backup_20260330_v2.json | 2026-03-30 | 同日第二次备份 |
| games_backup_20260411.json | 2026-04-11 | 封面修复后的备份 |
| games_backup_before_cover_fix.json | 封面修复前 | 历史节点备份 |
| games_backup_before_tagfix.json | 标签修复前 | 历史节点备份 |
| games_YYYY-MM-DDTHH-MM-SS.json | 自动 | admin 面板「备份」按钮生成的时间戳备份 |

## 注意事项

1. **旧备份可能引用已删除的封面**：2026-08 清理过 39 张孤儿封面图，从旧备份恢复后个别游戏封面可能 404（图片文件可从 git 历史找回：`git log --all -- public/covers/<文件名>`）。
2. **禁止从命名模糊的"副本"文件恢复**：恢复只认本目录下的 `.json`，admin 面板已加格式校验。
3. **备份命名规则**：新增备份一律使用 `games_<ISO时间戳>.json`（admin 面板自动生成），不再手工命名。
4. **games.json 是唯一数据真理**：Excel 仅作批量导入源，导入后以 JSON 为准。
