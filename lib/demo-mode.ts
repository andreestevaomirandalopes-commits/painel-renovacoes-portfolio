export const demoModeMessage =
  "Envio bloqueado: esta é uma demonstração de portfólio.";

export function isDemoMode() {
  return process.env.DEMO_MODE?.trim().toLowerCase() === "true";
}
