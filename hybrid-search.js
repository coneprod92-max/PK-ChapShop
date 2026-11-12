/* Recherche locale hybride : correspondances pondérées, synonymes et fautes simples. */
(() => {
  const STOP_WORDS = new Set([
    "a", "au", "aux", "avec", "chez", "de", "des", "du", "en", "et",
    "la", "le", "les", "ma", "mon", "ou", "pour", "un", "une", "dans"
  ]);

  const SYNONYMS = {
    boutique: ["commerce", "magasin", "shop", "enseigne"],
    commerce: ["boutique", "magasin", "shop", "enseigne"],
    magasin: ["boutique", "commerce", "shop", "enseigne"],
    restaurant: ["resto", "maquis", "repas", "cuisine"],
    resto: ["restaurant", "maquis", "repas"],
    nourriture: ["aliment", "alimentaire", "repas", "cuisine"],
    vetement: ["habillement", "mode", "habit", "vetement"],
    habillement: ["vetement", "mode", "habit"],
    chaussure: ["chaussures", "basket", "soulier", "sandale"],
    telephone: ["portable", "smartphone", "mobile"],
    portable: ["telephone", "smartphone", "mobile"],
    cosmetique: ["beaute", "soin", "maquillage"],
    beaute: ["cosmetique", "soin", "maquillage"],
    meuble: ["mobilier", "ameublement"],
    coiffure: ["coiffeur", "salon"],
    transport: ["taxi", "moto", "deplacement"],
    pharmacie: ["medicament", "sante"],
    bijou: ["bijoux", "accessoire", "accessoires"],
    bijoux: ["bijou", "accessoire", "accessoires"],
    livraison: ["livrer", "livraison", "commande"]
  };

  function normalize(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("fr-FR")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function getQueryTokens(query) {
    return normalize(query)
      .split(/\s+/)
      .filter(token => token && !STOP_WORDS.has(token));
  }

  function editDistanceWithin(left, right, limit) {
    if (Math.abs(left.length - right.length) > limit) return limit + 1;

    let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

    for (let row = 1; row <= left.length; row += 1) {
      const current = [row];
      let rowMinimum = row;

      for (let column = 1; column <= right.length; column += 1) {
        const cost = left[row - 1] === right[column - 1] ? 0 : 1;
        const distance = Math.min(
          current[column - 1] + 1,
          previous[column] + 1,
          previous[column - 1] + cost
        );
        current[column] = distance;
        rowMinimum = Math.min(rowMinimum, distance);
      }

      if (rowMinimum > limit) return limit + 1;
      previous = current;
    }

    return previous[right.length];
  }

  function scoreField(token, field) {
    const words = normalize(field.value).split(/\s+/).filter(Boolean);
    const alternatives = [token, ...(SYNONYMS[token] || [])];
    let best = 0;

    for (const word of words) {
      for (const alternative of alternatives) {
        if (word === alternative) {
          best = Math.max(best, field.weight);
        } else if (word.startsWith(alternative) && alternative.length >= 3) {
          best = Math.max(best, field.weight * 0.88);
        } else if (alternative.startsWith(word) && word.length >= 4) {
          best = Math.max(best, field.weight * 0.72);
        } else if (alternative.length >= 4) {
          const limit = alternative.length >= 8 ? 2 : 1;
          if (editDistanceWithin(alternative, word, limit) <= limit) {
            best = Math.max(best, field.weight * 0.62);
          }
        }
      }
    }

    return best;
  }

  function scoreFields(query, fields) {
    const tokens = getQueryTokens(query);
    if (!tokens.length) return 0;

    let total = 0;

    for (const token of tokens) {
      let tokenScore = 0;

      for (const field of fields) {
        tokenScore = Math.max(tokenScore, scoreField(token, field));
      }

      if (!tokenScore) return 0;
      total += tokenScore;
    }

    const phrase = normalize(query);
    if (phrase.length >= 3 && fields.some(field =>
      normalize(field.value).includes(phrase)
    )) {
      total += 4;
    }

    return total;
  }

  function getCategory(store, data) {
    return (data.categories || []).find(
      category => String(category.id) === String(store.category_id)
    );
  }

  function matchStore(store, query, data) {
    const category = getCategory(store, data);
    const fields = [
      { value: store.name, weight: 12 },
      { value: store.description, weight: 4 },
      { value: store.city, weight: 4 },
      { value: store.address, weight: 3 },
      { value: category?.name, weight: 9 },
      { value: category?.slug, weight: 5 }
    ];

    (data.products || [])
      .filter(product => String(product.store_id) === String(store.id))
      .forEach(product => {
        fields.push(
          { value: product.name, weight: 7 },
          { value: product.description, weight: 2 }
        );
      });

    return scoreFields(query, fields);
  }

  function matchProduct(product, query, data) {
    const store = (data.stores || []).find(
      item => String(item.id) === String(product.store_id)
    );
    const category = store ? getCategory(store, data) : null;

    return scoreFields(query, [
      { value: product.name, weight: 12 },
      { value: product.description, weight: 4 },
      { value: store?.name, weight: 7 },
      { value: store?.city, weight: 3 },
      { value: category?.name, weight: 6 },
      { value: category?.slug, weight: 3 }
    ]);
  }

  function getSuggestions(query, data) {
    if (!getQueryTokens(query).length) return [];

    const suggestions = [];

    (data.categories || []).forEach(category => {
      const score = scoreFields(query, [
        { value: category.name, weight: 10 },
        { value: category.slug, weight: 6 }
      ]);

      if (score) {
        suggestions.push({
          type: "category",
          label: category.name,
          id: category.id,
          score
        });
      }
    });

    (data.stores || []).forEach(store => {
      const score = matchStore(store, query, data);
      if (score) {
        suggestions.push({
          type: "store",
          label: store.name,
          score
        });
      }
    });

    (data.products || []).forEach(product => {
      const score = matchProduct(product, query, data);
      if (score) {
        suggestions.push({
          type: "product",
          label: product.name,
          score
        });
      }
    });

    const typeOrder = { category: 0, store: 1, product: 2 };
    return suggestions
      .sort((left, right) =>
        right.score - left.score || typeOrder[left.type] - typeOrder[right.type]
      )
      .slice(0, 7);
  }

  window.PKChapShopHybridSearch = {
    matchStore,
    matchProduct,
    getSuggestions
  };

  const input = document.getElementById("searchInput");
  const form = document.getElementById("searchForm");
  if (!input || !form) return;

  if (typeof window.PKChapShopGetSearchData !== "function") {
    console.error("La source locale de données de recherche est indisponible.");
    return;
  }

  const list = document.createElement("div");
  list.id = "searchSuggestions";
  list.className = "search-suggestions";
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", "Suggestions de recherche");
  list.hidden = true;
  form.append(list);

  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", list.id);
  input.setAttribute("aria-expanded", "false");

  let activeIndex = -1;

  function closeSuggestions() {
    list.hidden = true;
    activeIndex = -1;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  }

  function chooseSuggestion(suggestion) {
    closeSuggestions();

    if (suggestion.type === "category") {
      input.value = "";
      if (typeof window.filterCategory === "function") {
        window.filterCategory(suggestion.id);
      }
    } else {
      input.value = suggestion.label;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }

    document.getElementById("commerces-section")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  function renderSuggestions() {
    list.replaceChildren();
    activeIndex = -1;

    if (!normalize(input.value)) {
      closeSuggestions();
      return;
    }

    const suggestions = getSuggestions(
      input.value,
      window.PKChapShopGetSearchData()
    );

    suggestions.forEach((suggestion, index) => {
      const option = document.createElement("button");
      option.type = "button";
      option.id = `searchSuggestion-${index}`;
      option.className = "search-suggestion";
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");

      const label = document.createElement("span");
      label.className = "search-suggestion-label";
      label.textContent = suggestion.label;

      const type = document.createElement("span");
      type.className = "search-suggestion-type";
      type.textContent = {
        category: "Catégorie",
        store: "Commerce",
        product: "Produit"
      }[suggestion.type];

      option.append(label, type);
      option.addEventListener("mousedown", event => event.preventDefault());
      option.addEventListener("click", () => chooseSuggestion(suggestion));
      list.append(option);
    });

    list.hidden = suggestions.length === 0;
    input.setAttribute("aria-expanded", String(suggestions.length > 0));
  }

  function setActiveSuggestion(index) {
    const options = Array.from(list.querySelectorAll('[role="option"]'));
    if (!options.length) return;

    activeIndex = (index + options.length) % options.length;
    options.forEach((option, optionIndex) => {
      const active = optionIndex === activeIndex;
      option.setAttribute("aria-selected", String(active));
      option.classList.toggle("active", active);
    });
    input.setAttribute("aria-activedescendant", options[activeIndex].id);
  }

  input.addEventListener("input", renderSuggestions);
  input.addEventListener("focus", renderSuggestions);
  input.addEventListener("keydown", event => {
    if (event.key === "ArrowDown" && !list.hidden) {
      event.preventDefault();
      setActiveSuggestion(activeIndex + 1);
    } else if (event.key === "ArrowUp" && !list.hidden) {
      event.preventDefault();
      setActiveSuggestion(activeIndex <= 0
        ? list.querySelectorAll('[role="option"]').length - 1
        : activeIndex - 1
      );
    } else if (event.key === "Enter" && activeIndex >= 0 && !list.hidden) {
      event.preventDefault();
      const option = list.querySelectorAll('[role="option"]')[activeIndex];
      if (option) option.click();
    } else if (event.key === "Escape") {
      closeSuggestions();
    }
  });

  document.addEventListener("click", event => {
    if (!form.contains(event.target)) closeSuggestions();
  });
})();
