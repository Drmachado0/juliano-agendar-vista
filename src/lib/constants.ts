// URL oficial para deixar avaliação no Google Business Profile
// do Dr. Juliano Machado - Oftalmologista (Paragominas).
// Validada em produção: abre direto o popup "Escrever avaliação".
export const GOOGLE_REVIEW_URL = "https://g.page/r/CTkTpXB1m13mEAE/review";

// Número real de avaliações do Google — usado em toda a interface
// para evitar inconsistência entre páginas. Atualizar conforme as
// avaliações reais crescem no perfil do Google Business.
export const GOOGLE_REVIEWS = {
  rating: 5.0,
  count: 10,
} as const;
