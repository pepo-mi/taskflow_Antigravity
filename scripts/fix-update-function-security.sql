-- Fix security vulnerability in update_updated_at_column function
-- Issue: Function does not set its search_path, making it vulnerable to schema injection
-- Solution: Set search_path = '' to avoid mutable search path resolution

CREATE OR REPLACE FUNCTION public.update_updated_at_column() 
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = '' 
AS $$ 
BEGIN 
    NEW.updated_at := now(); 
    RETURN NEW; 
END; 
$$;
