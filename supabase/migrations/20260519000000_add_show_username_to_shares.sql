-- 添加 show_username 字段到 shares 表
-- 用于控制是否在分享页面显示用户名

ALTER TABLE shares
ADD COLUMN show_username BOOLEAN DEFAULT true;

-- 添加注释
COMMENT ON COLUMN shares.show_username IS '是否显示用户名（true=显示，false=匿名分享）';

-- 为现有数据设置默认值
UPDATE shares SET show_username = true WHERE show_username IS NULL;
