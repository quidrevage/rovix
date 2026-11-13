"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { withActiveDay } from "@/lib/streak";

// Типизация пользователя
type UserType = {
  uid: string;
  displayName: string;
  email: string;
};

/** Either the new data, or a function of the latest data (use it after an `await`, when `userData` may be stale). */
type UserDataUpdate = any | ((current: any) => any);

interface UserContextType {
  user: UserType | null;
  loading: boolean;
  userData: any;
  setUserData: (update: UserDataUpdate) => void;
}

const STORAGE_KEY = "fitai_user_data";

const UserContext = createContext<UserContextType>({} as UserContextType);

export const useUser = () => useContext(UserContext);

const parse = (raw: string | null) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("Error parsing local data", e);
    return null;
  }
};

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  // 1. ЖЕСТКО ЗАДАЕМ ПОЛЬЗОВАТЕЛЯ (Фейковый вход)
  const [user] = useState<UserType>({
    uid: "local-admin-user",
    displayName: "Admin",
    email: "admin@myself.com",
  });

  const [userData, setUserDataState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // Always the latest data, so updates made right after each other or after a long request never overwrite one another.
  const latest = useRef<any>(null);

  // 2. ПРИ ЗАГРУЗКЕ ЧИТАЕМ ИЗ БРАУЗЕРА (LocalStorage)
  useEffect(() => {
    latest.current = parse(localStorage.getItem(STORAGE_KEY));
    setUserDataState(latest.current);
    setLoading(false);

    // Keep several open tabs in sync.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      latest.current = parse(event.newValue);
      setUserDataState(latest.current);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // 3. ФУНКЦИЯ СОХРАНЕНИЯ (Вместо базы данных)
  const setUserData = useCallback((update: UserDataUpdate) => {
    const next = withActiveDay(typeof update === "function" ? update(latest.current) : update);
    latest.current = next;
    setUserDataState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("Error saving local data", e);
    }
  }, []);

  const value = useMemo(() => ({ user, loading, userData, setUserData }), [user, loading, userData, setUserData]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
