(() => {
  'use strict';

  const link = document.getElementById('chess-rating');
  const value = document.getElementById('chess-rating-value');
  if (!link || !value) return;

  fetch('https://api.chess.com/pub/player/callmejustdodo/stats')
    .then(response => {
      if (!response.ok) throw new Error(`Chess.com returned ${response.status}`);
      return response.json();
    })
    .then(stats => {
      const rating = stats.chess_rapid?.last?.rating;
      if (!Number.isInteger(rating) || rating <= 0) return;
      value.textContent = new Intl.NumberFormat('en').format(rating);
      link.hidden = false;
    })
    .catch(() => {
      // Keep the optional rating hidden if Chess.com is unavailable.
    });
})();
