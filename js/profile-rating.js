document.addEventListener("DOMContentLoaded", () => {
  const albumCards = document.querySelectorAll(".album-card");

  albumCards.forEach(card => {
    const albumId = card.dataset.album;
    const ratingDisplay = card.querySelector(".rating-display");

    const savedRating = localStorage.getItem(albumId);

    if (savedRating) {
      ratingDisplay.textContent =
        `Ta note : ${"★".repeat(savedRating)}${"☆".repeat(5 - savedRating)}`;
      ratingDisplay.style.color = "#00e054";
    } else {
      ratingDisplay.textContent = "Non noté";
      ratingDisplay.style.color = "#9aa4ad";
    }
  });
});