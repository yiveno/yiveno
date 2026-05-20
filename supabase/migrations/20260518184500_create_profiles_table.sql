-- 创建用户资料表
-- 用于存储用户的公开信息，支持用户搜索功能

-- =====================================================
-- 1. 用户资料表
-- =====================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,  -- 用户昵称
  email TEXT,  -- 用户邮箱（从 auth.users 同步）
  avatar_url TEXT,  -- 头像 URL
  bio TEXT,  -- 个人简介
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_profiles_name ON public.profiles USING gin(to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles USING gin(to_tsvector('simple', email));

-- 注释
COMMENT ON TABLE public.profiles IS '用户资料表，存储用户的公开信息';
COMMENT ON COLUMN public.profiles.name IS '用户昵称，用于显示和搜索';
COMMENT ON COLUMN public.profiles.email IS '用户邮箱，从 auth.users 同步';

-- =====================================================
-- 2. Row Level Security (RLS) 策略
-- =====================================================

-- 启用 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 所有人可以查看用户资料（用于搜索）
CREATE POLICY "Anyone can view profiles"
  ON public.profiles FOR SELECT
  USING (true);

-- 用户可以更新自己的资料
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- 用户可以插入自己的资料
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- =====================================================
-- 3. 触发器：自动创建用户资料
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 当新用户注册时，自动创建 profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 4. 触发器：自动更新 updated_at
-- =====================================================
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- 5. 为现有用户创建 profiles
-- =====================================================
INSERT INTO public.profiles (id, name, email, avatar_url)
SELECT 
  id,
  COALESCE(raw_user_meta_data->>'name', raw_user_meta_data->>'full_name', split_part(email, '@', 1)) as name,
  email,
  raw_user_meta_data->>'avatar_url' as avatar_url
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;
