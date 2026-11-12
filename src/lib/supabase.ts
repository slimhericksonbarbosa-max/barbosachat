import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import { createClient, type SupportedStorage } from "@supabase/supabase-js";

// These are public client settings, safe to include in a mobile application.
// Never put a Supabase secret/service_role key in this file.
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || "https://eipsdzkqhnsylvizycan.supabase.co";
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_48m4kNw-ZlF0ttv_UL8-6A_ZLRGcLhb";

const secureStorage: SupportedStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
