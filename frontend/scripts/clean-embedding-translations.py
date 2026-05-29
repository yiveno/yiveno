#!/usr/bin/env python3
"""
清理翻译文件中的 embedding 设置相关键

删除所有 settings_embedding_* 相关的翻译键
"""

import json
import os
from pathlib import Path

# 翻译文件目录
LOCALES_DIR = Path(__file__).parent.parent / 'public' / '_locales'

# 要删除的键前缀
KEYS_TO_DELETE = [
    'settings_embedding_title',
    'settings_embedding_auto_generate',
    'settings_embedding_auto_generate_tooltip_title',
    'settings_embedding_auto_generate_tooltip_1',
    'settings_embedding_auto_generate_tooltip_2',
    'settings_embedding_auto_generate_tooltip_3',
    'settings_embedding_daily_quota',
    'settings_embedding_daily_quota_tooltip_title',
    'settings_embedding_daily_quota_tooltip_1',
    'settings_embedding_daily_quota_tooltip_2',
    'settings_embedding_daily_quota_tooltip_3',
    'settings_embedding_daily_quota_placeholder',
    'settings_embedding_per_run_max',
    'settings_embedding_per_run_max_tooltip_title',
    'settings_embedding_per_run_max_tooltip_1',
    'settings_embedding_per_run_max_tooltip_2',
    'settings_embedding_per_run_max_tooltip_3',
    'settings_embedding_per_run_max_placeholder',
    'settings_embedding_night_idle_only',
    'settings_embedding_night_idle_only_tooltip_title',
    'settings_embedding_night_idle_only_tooltip_1',
    'settings_embedding_night_idle_only_tooltip_2',
    'settings_embedding_night_idle_only_tooltip_3',
]

def clean_messages_file(file_path: Path) -> tuple[int, int]:
    """
    清理单个翻译文件
    
    Returns:
        (删除的键数量, 剩余的键数量)
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    original_count = len(data)
    deleted_count = 0
    
    # 删除所有 embedding 相关的键
    for key in KEYS_TO_DELETE:
        if key in data:
            del data[key]
            deleted_count += 1
    
    # 写回文件（保持格式）
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')  # 添加末尾换行符
    
    remaining_count = len(data)
    return deleted_count, remaining_count

def main():
    """主函数"""
    print('🧹 开始清理翻译文件中的 embedding 设置相关键...\n')
    
    total_deleted = 0
    processed_files = 0
    
    # 遍历所有语言目录
    for locale_dir in LOCALES_DIR.iterdir():
        if not locale_dir.is_dir():
            continue
        
        messages_file = locale_dir / 'messages.json'
        if not messages_file.exists():
            continue
        
        locale_name = locale_dir.name
        deleted, remaining = clean_messages_file(messages_file)
        
        if deleted > 0:
            print(f'✅ {locale_name:8s} - 删除 {deleted:2d} 个键，剩余 {remaining:4d} 个键')
            total_deleted += deleted
            processed_files += 1
        else:
            print(f'⏭️  {locale_name:8s} - 无需清理')
    
    print(f'\n✨ 清理完成！')
    print(f'   - 处理文件数: {processed_files}')
    print(f'   - 删除键总数: {total_deleted}')

if __name__ == '__main__':
    main()
