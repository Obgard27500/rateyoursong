document.addEventListener("DOMContentLoaded", () => {
  const MUSICBRAINZ_BASE = "https://musicbrainz.org/ws/2";
  const searchBtn = document.getElementById("search-btn");
  const input = document.getElementById("search-input");
  const resultsDiv = document.getElementById("results");
  const statusMessage = document.createElement("p");

  statusMessage.style.margin = "10px 0";
  searchBtn.insertAdjacentElement("afterend", statusMessage);

  searchBtn.addEventListener("click", searchAlbums);

  async function searchAlbums() {
    const query = input.value.trim();
    if (!query) return;

    resultsDiv.innerHTML = "Chargement...";
    statusMessage.textContent = "";

    const allResults = await fetchAllAlbums(query);
    resultsDiv.innerHTML = "";

    if (!allResults.length) {
      resultsDiv.innerHTML = "<p>Aucun résultat</p>";
      return;
    }

    const albumsToAdd = allResults.map(release => {
      const releaseGroup = release["release-group"] || {};
      return {
        id: release.id,
        type: resolveReleaseType(releaseGroup),
        title: release.title,
        artist: formatArtistCredit(release["artist-credit"]),
        year: (release.date || "").slice(0, 4),
        image: buildCoverUrl(release.id, releaseGroup.id, release["cover-art-archive"])
      };
    });

    const addedCount = addAlbums(albumsToAdd);
    statusMessage.textContent = `${addedCount} élément(s) ajouté(s) automatiquement.`;

    const storedIds = new Set((JSON.parse(localStorage.getItem("albums")) || []).map(album => album.id));

    albumsToAdd.forEach(albumData => {
      const card = document.createElement("div");
      card.className = "album-card";
      const alreadySaved = storedIds.has(albumData.id);

      card.innerHTML = `
        <img src="${albumData.image}">
        <h3>${albumData.title}</h3>
        <p>${albumData.artist} • ${albumData.year || "N/A"}</p>
        <p class="media-type-badge">${albumData.type === "single" ? "Single" : "Album"}</p>
        <button disabled>${alreadySaved ? "Déjà ajouté" : "Ajouté"}</button>
      `;

      resultsDiv.appendChild(card);
    });
  }

  async function fetchAllAlbums(query) {
    const allResults = [];
    const pageSize = 100;
    const maxPages = 3;

    for (let page = 0; page < maxPages; page += 1) {
      const offset = page * pageSize;
      const url = `${MUSICBRAINZ_BASE}/release?query=${encodeURIComponent(query)}&fmt=json&limit=${pageSize}&offset=${offset}`;

      const res = await fetch(url);
      if (!res.ok) break;

      const data = await res.json();
      const results = data.releases || [];

      if (!results.length) break;

      allResults.push(...results);

      if (results.length < pageSize) break;
      await wait(250);
    }

    return allResults;
  }

  function addAlbums(newAlbums) {
    const albums = JSON.parse(localStorage.getItem("albums")) || [];
    let addedCount = 0;

    newAlbums.forEach(album => {
      if (albums.some(existingAlbum => existingAlbum.id === album.id)) return;
      albums.push(album);
      addedCount += 1;
    });

    localStorage.setItem("albums", JSON.stringify(albums));
    return addedCount;
  }

  function resolveReleaseType(releaseGroup) {
    const primary = String(releaseGroup["primary-type"] || "").toLowerCase();
    const secondary = (releaseGroup["secondary-types"] || []).map(type => String(type).toLowerCase());
    if (primary === "single" || secondary.includes("single")) return "single";
    return "album";
  }

  function formatArtistCredit(artistCredit) {
    if (!Array.isArray(artistCredit) || !artistCredit.length) return "Artiste inconnu";
    return artistCredit
      .map(entry => entry.name || (entry.artist && entry.artist.name) || "")
      .join("")
      .trim() || "Artiste inconnu";
  }

  function buildCoverUrl(releaseId, releaseGroupId, coverArchive) {
    if (coverArchive && coverArchive.front) {
      return `https://coverartarchive.org/release/${releaseId}/front-250`;
    }
    if (releaseGroupId) {
      return `https://coverartarchive.org/release-group/${releaseGroupId}/front-250`;
    }
    return "images/album1.jpg";
  }

  function wait(ms) {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }
});
