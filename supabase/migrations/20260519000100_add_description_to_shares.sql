-- 添加 description 字段到 shares 表
-- 用于存储分享的描述信息

ALTER TABLE shares
ADD COLUMN description TEXT;

-- 添加注释
COMMENT ON COLUMN shares.description IS '分享描述（可选，最多 1000 字符）';
