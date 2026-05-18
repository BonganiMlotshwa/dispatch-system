import { useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { getChartOptions, getChartColors } from '../utils/chartTheme';

export const useChartTheme = (baseOptions = {}) => {
  const { resolvedTheme } = useTheme();
  
  const chartOptions = useMemo(() => {
    return getChartOptions(resolvedTheme, baseOptions);
  }, [resolvedTheme, baseOptions]);
  
  const chartColors = useMemo(() => {
    return getChartColors(resolvedTheme);
  }, [resolvedTheme]);
  
  return {
    chartOptions,
    chartColors,
    isDark: resolvedTheme === 'dark'
  };
};