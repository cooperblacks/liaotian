-- Tentative Summary as a unified SQL schema (Current structure)

-- Create profiles table with all columns
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  display_name text NOT NULL,
  bio text DEFAULT '',
  avatar_url text DEFAULT '',
  banner_url text DEFAULT '',
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  theme text DEFAULT 'lt-classic',
  verification_request text DEFAULT '',
  last_seen timestamptz
);

-- Create posts table with all columns
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  media_url text DEFAULT '',
  media_type text DEFAULT 'image',
  created_at timestamptz DEFAULT now()
);

-- Create follows table
CREATE TABLE IF NOT EXISTS follows (
  follower_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (follower_id, following_id)
);

-- Create messages table with all columns
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  media_url text DEFAULT '',
  media_type text DEFAULT 'image',
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  reply_to_id uuid REFERENCES messages(id) ON DELETE SET NULL,
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE
);

-- Create groups table with all columns
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  creator_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  avatar_url text DEFAULT '',
  banner_url text DEFAULT ''
);

-- Create group_members table with all columns
CREATE TABLE IF NOT EXISTS group_members (
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  is_admin boolean DEFAULT false,
  PRIMARY KEY (group_id, user_id)
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Policies for posts
CREATE POLICY "Posts are viewable by everyone" ON posts FOR SELECT USING (true);
CREATE POLICY "Users can create own posts" ON posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Policies for follows
CREATE POLICY "Follows are viewable by everyone" ON follows FOR SELECT USING (true);
CREATE POLICY "Users can follow others" ON follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow" ON follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- Policies for messages (final versions supporting groups)
CREATE POLICY "Users can view DMs" ON messages FOR SELECT TO authenticated USING ((auth.uid() = sender_id OR auth.uid() = recipient_id) AND group_id IS NULL);
CREATE POLICY "Users can view group messages" ON messages FOR SELECT TO authenticated USING (group_id IS NOT NULL AND EXISTS (SELECT 1 FROM group_members WHERE group_id = messages.group_id AND user_id = auth.uid()));
CREATE POLICY "Users can send DMs" ON messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id AND group_id IS NULL);
CREATE POLICY "Users can send group messages" ON messages FOR INSERT TO authenticated WITH CHECK (group_id IS NOT NULL AND auth.uid() = sender_id AND EXISTS (SELECT 1 FROM group_members WHERE group_id = messages.group_id AND user_id = auth.uid()));
CREATE POLICY "Users can mark DMs as read" ON messages FOR UPDATE TO authenticated USING ((auth.uid() = recipient_id) AND group_id IS NULL) WITH CHECK (auth.uid() = recipient_id);

-- Policies for groups (with fixes for recursion and creation flow)
DROP POLICY IF EXISTS "Groups viewable by members" ON groups;
CREATE POLICY "Groups viewable by members" ON groups
  FOR SELECT TO authenticated
  USING (
    -- Creator can view the group (crucial for group creation flow)
    groups.creator_id = auth.uid()
    OR
    -- Existing member can view the group (uses the now non-recursive group_members SELECT RLS)
    EXISTS (SELECT 1 FROM group_members WHERE group_id = groups.id AND user_id = auth.uid())
  );
DROP POLICY IF EXISTS "Creators can create groups" ON groups;
CREATE POLICY "Creators can create groups" ON groups FOR INSERT WITH CHECK (auth.uid() = creator_id);
DROP POLICY IF EXISTS "Admins and creators can update groups" ON groups;
CREATE POLICY "Admins and creators can update groups" ON groups FOR UPDATE USING (auth.uid() = creator_id OR EXISTS (SELECT 1 FROM group_members WHERE group_id = groups.id AND user_id = auth.uid() AND is_admin = true)) WITH CHECK (auth.uid() = creator_id OR EXISTS (SELECT 1 FROM group_members WHERE group_id = groups.id AND user_id = auth.uid() AND is_admin = true));
DROP POLICY IF EXISTS "Admins and creators can delete groups" ON groups;
CREATE POLICY "Admins and creators can delete groups" ON groups FOR DELETE USING (auth.uid() = creator_id OR EXISTS (SELECT 1 FROM group_members WHERE group_id = groups.id AND user_id = auth.uid() AND is_admin = true));

-- Policies for group_members (with fix for recursion on SELECT)
DROP POLICY IF EXISTS "Members viewable by members" ON group_members;
CREATE POLICY "Members viewable by self" ON group_members
  FOR SELECT TO authenticated
  USING (group_members.user_id = auth.uid());
DROP POLICY IF EXISTS "Admins and creators can insert members" ON group_members;
CREATE POLICY "Admins and creators can insert members" ON group_members FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM groups WHERE id = group_members.group_id AND creator_id = auth.uid()) OR EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid() AND gm.is_admin = true));
DROP POLICY IF EXISTS "Admins and creators can update member roles" ON group_members;
CREATE POLICY "Admins and creators can update member roles" ON group_members FOR UPDATE USING ((EXISTS (SELECT 1 FROM groups WHERE id = group_members.group_id AND creator_id = auth.uid()) OR EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid() AND gm.is_admin = true)) AND auth.uid() <> user_id) WITH CHECK (true);
DROP POLICY IF EXISTS "Admins, creators, and member can delete members" ON group_members;
CREATE POLICY "Admins, creators, and member can delete members" ON group_members FOR DELETE USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM groups WHERE id = group_members.group_id AND creator_id = auth.uid()) OR EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_members.group_id AND gm.user_id = auth.uid() AND gm.is_admin = true));

-- Create storage bucket and policies
INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true) ON CONFLICT DO NOTHING;
CREATE POLICY "Anyone can view media" ON storage.objects FOR SELECT USING (bucket_id = 'media');
CREATE POLICY "Users can upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'media');
CREATE POLICY "Users can delete own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'media' AND (storage.foldername(name))[1] = (SELECT id::text FROM auth.users WHERE id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS posts_user_id_idx ON posts(user_id);
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS messages_sender_recipient_idx ON messages(sender_id, recipient_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS messages_group_id_idx ON messages(group_id);
CREATE INDEX IF NOT EXISTS group_members_group_id_idx ON group_members(group_id);
CREATE INDEX IF NOT EXISTS group_members_user_id_idx ON group_members(user_id);
