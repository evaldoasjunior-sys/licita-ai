export async function loadOpportunitiesWithFallback({ api, localStore }) {
  const localOpportunities = localStore.listAll();

  try {
    const result = await api.opportunities({ includeArchived: true });
    const remoteOpportunities = Array.isArray(result?.data) ? result.data : [];

    if (remoteOpportunities.length === 0 && localOpportunities.length > 0) {
      const migrated = await api.saveOpportunities(localOpportunities);
      const opportunities = Array.isArray(migrated?.data) ? migrated.data : localOpportunities;

      localStore.saveAll(opportunities);
      return {
        opportunities,
        source: "sqlite",
        message: "Dados locais migrados para o banco SQLite.",
      };
    }

    localStore.saveAll(remoteOpportunities);
    return {
      opportunities: remoteOpportunities,
      source: "sqlite",
      message: "Oportunidades carregadas do banco SQLite.",
    };
  } catch {
    return {
      opportunities: localOpportunities,
      source: "local",
      message: "Backend indisponivel. Usando oportunidades locais deste navegador.",
    };
  }
}
