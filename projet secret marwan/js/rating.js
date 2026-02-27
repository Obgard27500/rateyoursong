document.addEventListener("DOMContentLoaded", () => {
  const ratingContainer = document.querySelector(".rating");
  if (!ratingContainer) return;

  const stars = ratingContainer.querySelectorAll("span");
  const ratingText = document.getElementById("rating-text");

  const albumId = ratingContainer.dataset.album;

  // 🔁 Charger la note sauvegardée
  const savedRating = localStorage.getItem(albumId);

  if (savedRating) {
    setRating(savedRating);
    ratingText.textContent = `Ta note : ${savedRating}/5`;
  }

  // ⭐ Cliquer pour noter
  stars.forEach(star => {
    star.addEventListener("click", () => {
      const value = star.dataset.star;

      localStorage.setItem(albumId, value);
      setRating(value);
      ratingText.textContent = `Ta note : ${value}/5`;
    });
  });

  function setRating(value) {
    stars.forEach(star => {
      star.classList.toggle(
        "active",
        Number(star.dataset.star) <= Number(value)
      );
    });
  }
});