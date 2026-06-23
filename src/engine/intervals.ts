/**
 * Utilities for formatting semitone interval arrays as human-friendly degree labels.
 * Examples:
 *  [0,4,7] -> ["1","3","5"]
 *  [0,3,7] -> ["1","b3","5"]
 *  [0,4,7,10,14] -> ["1","3","5","b7","9"]
 */
export function formatIntervalsAsDegrees(intervals: number[]): string[] {
  if (!Array.isArray(intervals)) return [];

  return intervals.map((i) => {
    // Common explicit mappings (covers typical chord extensions used in the app)
    switch (i) {
      case 0: return '1';
      case 1: return 'b2';
      case 2: return '2';
      case 3: return 'b3';
      case 4: return '3';
      case 5: return '4';
      case 6: return 'b5';
      case 7: return '5';
      case 8: return '#5';
      case 9: return '6';
      case 10: return 'b7';
      case 11: return '7';
      // Extended (above octave)
      case 13: return 'b9';
      case 14: return '9';
      case 15: return '#9';
      case 17: return '11';
      case 18: return '#11';
      case 20: return 'b13';
      case 21: return '13';
      default: {
        // Best-effort fallback: map modulo 12 to a sensible label for uncommon numbers
        if (i > 12) {
          const mod = i % 12;
          if (mod === 1) return 'b9';
          if (mod === 2) return '9';
          if (mod === 3) return '#9';
          if (mod === 5) return '11';
          if (mod === 6) return '#11';
          if (mod === 8) return 'b13';
          if (mod === 9) return '13';
        }
        // Last resort: show the semitone number so we don't hide information
        return String(i);
      }
    }
  });
}
