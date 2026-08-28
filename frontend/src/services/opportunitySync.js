export async function loadOpportunitiesWithFallback({ api, localStore, draftStore }) {
  const localOpportunities = localStore.listAll();

  try {
    const result = await api.opportunities({ includeArchived: true });
    const remoteOpportunities = Array.isArray(result?.data) ? result.data : [];

    if (remoteOpportunities.length === 0 && localOpportunities.length > 0) {
      draftStore?.preserveLegacyImport?.(localOpportunities);
    }

    localStore.saveAll(remoteOpportunities);
    return {
      opportunities: remoteOpportunities,
      source: "sqlite",
      message:
        remoteOpportunities.length === 0 && localOpportunities.length > 0
          ? "SQLite vazio. Os dados locais anteriores foram preservados como rascunho; confirme a importacao antes de enviar."
          : "Oportunidades carregadas do banco SQLite.",
    };
  } catch {
    return {
      opportunities: localOpportunities,
      source: "local",
      message: "Backend indisponivel. Usando oportunidades locais deste navegador.",
    };
  }
}
