-- v87: completed_tours — фіксування пройдених турів для користувача
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS completed_tours TEXT[] DEFAULT '{}';
