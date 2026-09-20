/**
 * Utility to check if a given date is a valid working day.
 * Blocks Sundays, 1st and 3rd Saturdays, and fixed National Holidays.
 */
export const isWorkingDay = (dateStr: string): { isValid: boolean; reason?: string } => {
  if (!dateStr) return { isValid: true };
  
  // Parse YYYY-MM-DD strictly in local time to avoid UTC offset issues
  const parts = dateStr.split('-');
  if (parts.length !== 3) return { isValid: false, reason: "Invalid date format." };
  
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const dateNum = parseInt(parts[2], 10);
  
  const d = new Date(year, monthIdx, dateNum);
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

/**
 * Returns the provided date if it is a working day,
 * otherwise advances the date day-by-day until a valid working day is found.
 */
export const getNextWorkingDay = (date: Date): Date => {
  const result = new Date(date);
  
  // Loop until we find a working day (max 30 days to prevent infinite loop just in case)
  let loopCount = 0;
  while (loopCount < 30) {
    // Format to YYYY-MM-DD for checking
    const yyyy = result.getFullYear();
    const mm = String(result.getMonth() + 1).padStart(2, '0');
    const dd = String(result.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    
    if (isWorkingDay(dateStr).isValid) {
      break;
    }
    
    // Add 1 day
    result.setDate(result.getDate() + 1);
    loopCount++;
  }
  
  return result;
};

/**
 * Calculates the number of valid working days between two dates.
 * Used to calculate true duration, days left, and penalty delays excluding holidays.
 */
export const getWorkingDaysCount = (startDate: Date | string, endDate: Date | string): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Normalize to midnight
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  if (start.getTime() >= end.getTime()) {
    return 0;
  }

  let count = 0;
  let current = new Date(start);
  
  while (current.getTime() < end.getTime()) {
    current.setDate(current.getDate() + 1);
    
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    
    if (isWorkingDay(`${yyyy}-${mm}-${dd}`).isValid) {
      count++;
    }
  }
  
  return count;
};
