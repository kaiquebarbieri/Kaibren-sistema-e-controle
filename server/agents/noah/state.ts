/**
 * State em memória do Noah cron (em produção real, persistir em banco).
 * Evita spam de alertas e duplicação de execuções no mesmo dia.
 */

type State = {
  lastDailyRecap: string | null; // YYYY-MM-DD
  lastWeeklyRecap: string | null;
  lastMonthlyRecap: string | null;
  lastUrgentByKey: Record<string, string>; // key → ISO timestamp
};

const state: State = {
  lastDailyRecap: null,
  lastWeeklyRecap: null,
  lastMonthlyRecap: null,
  lastUrgentByKey: {},
};

export function shouldRunDaily(today: string): boolean {
  return state.lastDailyRecap !== today;
}
export function markDailyDone(today: string) { state.lastDailyRecap = today; }

export function shouldRunWeekly(today: string): boolean {
  return state.lastWeeklyRecap !== today;
}
export function markWeeklyDone(today: string) { state.lastWeeklyRecap = today; }

export function shouldRunMonthly(today: string): boolean {
  return state.lastMonthlyRecap !== today;
}
export function markMonthlyDone(today: string) { state.lastMonthlyRecap = today; }

/** Cooldown de 6h por sinal urgente — evita repetir o mesmo alerta */
export function shouldFireUrgent(key: string): boolean {
  const last = state.lastUrgentByKey[key];
  if (!last) return true;
  const hoursAgo = (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60);
  return hoursAgo >= 6;
}
export function markUrgentFired(key: string) {
  state.lastUrgentByKey[key] = new Date().toISOString();
}

export function getNoahState() {
  return { ...state };
}
