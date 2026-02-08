import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './auth';

interface Settings {
  theme: 'light' | 'dark';
  layout_density: 'compact' | 'comfortable' | 'spacious';
  notifications_enabled: boolean;
  sound_enabled: boolean;
}

interface SettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
  loading: boolean;
}

const defaultSettings: Settings = {
  theme: 'light',
  layout_density: 'comfortable',
  notifications_enabled: true,
  sound_enabled: true,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  // Apply theme to document
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(settings.theme);
  }, [settings.theme]);

  // Fetch settings from database
  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) {
        // Load from localStorage for non-authenticated users
        const stored = localStorage.getItem('zainn-settings');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            setSettings({ ...defaultSettings, ...parsed });
          } catch {
            setSettings(defaultSettings);
          }
        }
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // No settings found, create default
            await supabase.from('user_settings').insert({
              user_id: user.id,
              ...defaultSettings,
            });
          } else {
            console.error('Error fetching settings:', error);
          }
        } else if (data) {
          setSettings({
            theme: data.theme as 'light' | 'dark',
            layout_density: data.layout_density as 'compact' | 'comfortable' | 'spacious',
            notifications_enabled: data.notifications_enabled,
            sound_enabled: data.sound_enabled,
          });
        }
      } catch (err) {
        console.error('Error in fetchSettings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [user]);

  const updateSettings = useCallback(async (newSettings: Partial<Settings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);

    // Save to localStorage
    localStorage.setItem('zainn-settings', JSON.stringify(updated));

    // Save to database if authenticated
    if (user) {
      try {
        await supabase
          .from('user_settings')
          .update({
            theme: updated.theme,
            layout_density: updated.layout_density,
            notifications_enabled: updated.notifications_enabled,
            sound_enabled: updated.sound_enabled,
          })
          .eq('user_id', user.id);
      } catch (err) {
        console.error('Error updating settings:', err);
      }
    }
  }, [settings, user]);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
