// apiUrl is replaced at build time by .github/workflows/pages.yml
// (falls back to this placeholder for a plain local `ng build`).
export const environment = {
  production: true,
  apiUrl: 'https://__API_BASE_URL__/'
};
