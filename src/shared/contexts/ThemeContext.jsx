import { createContext, useContext, useState, useMemo } from "react";
import { LIGHT, DARK, getStatusConfig } from "../../theme";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(
    () => localStorage.getItem("rentai_theme") === "dark"
  );

  const T = isDark ? DARK : LIGHT;
  const STATUS_CONFIG = useMemo(() => getStatusConfig(T), [isDark]);

  const toggle = () => {
    setIsDark((d) => {
      localStorage.setItem("rentai_theme", !d ? "dark" : "light");
      return !d;
    });
  };

  return (
    <ThemeContext.Provider value={{ T, STATUS_CONFIG, isDark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
