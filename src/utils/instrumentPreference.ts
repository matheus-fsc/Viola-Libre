const PREFERRED_INSTRUMENT_KEY = 'viola_libre_preferred_instrument';

export function getPreferredInstrumentId(): string | null {
  try {
    return localStorage.getItem(PREFERRED_INSTRUMENT_KEY);
  } catch {
    return null;
  }
}

export function setPreferredInstrumentId(id: string): void {
  try {
    localStorage.setItem(PREFERRED_INSTRUMENT_KEY, id);
  } catch {
    // localStorage indisponível (modo privado etc.) — preferência só dura a sessão
  }
}
