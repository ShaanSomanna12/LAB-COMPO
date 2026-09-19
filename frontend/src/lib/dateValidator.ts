/**
 * Utility to check if a given date is a valid working day.
 * Blocks Sundays, 1st and 3rd Saturdays, and fixed National Holidays.
 */
export const isWorkingDay = (dateStr: string): { isValid: boolean; reason?: string } => {
  if (!dateStr) return { isValid: true };
  const d = new Date(dateStr);
  const day = d.getDay();
  const date = d.getDate();
  const month = d.getMonth() + 1; // 1-12

  // 1. Check Sundays
  if (day === 0) {
    return { isValid: false, reason: "Sundays are holidays." };
  }

  // 2. Check 1st and 3rd Saturdays
  if (day === 6) {
    // 1st Saturday: date is between 1 and 7
    if (date >= 1 && date <= 7) {
      return { isValid: false, reason: "1st Saturday of the month is a holiday." };
    }
    // 3rd Saturday: date is between 15 and 21
    if (date >= 15 && date <= 21) {
      return { isValid: false, reason: "3rd Saturday of the month is a holiday." };
    }
  }

  // 3. Check Fixed National Holidays
  const md = `${month.toString().padStart(2, '0')}-${date.toString().padStart(2, '0')}`;
  const fixedHolidays: Record<string, string> = {
    '01-26': 'Republic Day',
    '08-15': 'Independence Day',
    '10-02': 'Gandhi Jayanti',
    '05-01': 'May Day / Labor Day',
    '11-01': 'Karnataka Rajyotsava'
  };

  if (fixedHolidays[md]) {
    return { isValid: false, reason: `${fixedHolidays[md]} is a national holiday.` };
  }

  return { isValid: true };
};
