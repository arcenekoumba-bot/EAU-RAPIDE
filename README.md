# Eau Rapide

Eau Rapide est une application PWA mobile-first qui facilite la recherche et la livraison d’eau potable entre clients et livreurs.

## Fonctionnalités actuelles

- Interface client responsive en français.
- Recherche de livreurs disponibles par proximité.
- Géolocalisation du navigateur avec demande d’autorisation.
- Profils de livreurs vérifiés avec note, distance, disponibilité et contact.
- Création d’une demande de livraison avec quantité, adresse et total en FCFA.
- Suivi des commandes et évolution de leur statut.
- Espace livreur avec statut en ligne/hors ligne et indicateurs d’activité.
- Manifest PWA, icône et service worker.
- API tRPC de démonstration pour les livreurs et l’estimation du total.

## Installation locale

Pré-requis : Node.js 22 ou version compatible et pnpm 10.

```bash
pnpm install
pnpm dev
```

L’application est ensuite disponible sur `http://localhost:3000`.

## Vérifications

```bash
pnpm check
pnpm test
pnpm build
```

## Structure principale

- `client/src/pages/Home.tsx` : parcours client, livreur, commandes et profil.
- `client/src/index.css` : identité visuelle et styles responsive.
- `server/routers.ts` : endpoints tRPC du MVP.
- `client/public/manifest.webmanifest` : configuration PWA.
- `client/public/service-worker.js` : cache du shell de l’application.
- `drizzle/` : schéma et migrations de la base de données.

## Mise en ligne sur GitHub

Créer un dépôt GitHub privé vide, puis depuis ce dossier :

```bash
git init
git add .
git commit -m "Initialisation de l'application Eau Rapide"
git branch -M main
git remote add origin https://github.com/VOTRE_COMPTE/eau-rapide.git
git push -u origin main
```

Ne jamais téléverser de fichier `.env`, de mot de passe, de clé privée ou de secret d’API. Le fichier `.gitignore` exclut les dépendances, les builds et les secrets courants.

## Prochaines étapes recommandées

1. Remplacer les données de démonstration par les tables clients, livreurs et commandes.
2. Ajouter l’authentification réelle et les rôles client/livreur.
3. Brancher une cartographie et le calcul réel des distances.
4. Ajouter les notifications de commande.
5. Intégrer un abonnement ou une commission après validation du modèle économique.
