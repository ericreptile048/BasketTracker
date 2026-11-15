# BasketTracker

Une petite web app (PWA) pour suivre un programme de basket sur iPhone : séances guidées A et B, minuteurs, chronos, scores, validation « 2 séances réussies de suite », courbes de progrès.

- 100 % locale : les données restent dans le téléphone (localStorage), aucune requête réseau, export / import en JSON.
- Marche hors ligne une fois ajoutée à l'écran d'accueil (service worker).
- Aucune dépendance : HTML, CSS et JavaScript à la main, graphiques en SVG.

Tests de la logique : `node tests/data.test.js`
