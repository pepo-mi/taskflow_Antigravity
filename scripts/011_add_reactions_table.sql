-- Create reactions table for emoji reactions on posts
CREATE TABLE IF NOT EXISTS public.reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL CHECK (emoji IN ('✅', '👀', '🔥')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one reaction per user per post per emoji
    UNIQUE(post_id, user_id, emoji)
);

-- Add RLS policies for reactions
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

-- Users can view all reactions
CREATE POLICY "Users can view reactions" ON public.reactions
    FOR SELECT USING (true);

-- Users can insert their own reactions
CREATE POLICY "Users can insert their own reactions" ON public.reactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own reactions
CREATE POLICY "Users can delete their own reactions" ON public.reactions
    FOR DELETE USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_reactions_post_id ON public.reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON public.reactions(user_id);
