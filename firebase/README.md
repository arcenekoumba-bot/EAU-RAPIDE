# Eau Rapide avec Firebase

Ce dossier prépare le passage d'Eau Rapide vers une architecture partagée : Firebase Hosting pour la PWA et Firestore pour les profils, livreurs et commandes.

## Ce qui est déjà prêt

- `../firebase.json` configure Firebase Hosting et Firestore.
- `firestore.rules` protège les documents par utilisateur et par commande.
- `firestore.indexes.json` prépare les requêtes d'historique.
- `.env.firebase.example` décrit la configuration publique de l'application web Firebase.

Aucune clé personnelle ni secret n'est inclus dans le dépôt.

## Étape 1 — Créer le projet Firebase

1. Ouvrir <https://console.firebase.google.com/>.
2. Cliquer sur **Créer un projet**.
3. Donner un nom, par exemple `eau-rapide`.
4. Google Analytics peut rester désactivé pour le pilote.
5. Dans **Project settings > Your apps**, ajouter une application **Web**.
6. Copier les valeurs de configuration dans un fichier local nommé `.env.local` à partir de `.env.firebase.example`.

La configuration web Firebase n'est pas un mot de passe, mais elle ne doit pas être remplacée par les identifiants d'un compte administrateur.

## Étape 2 — Activer les services

Dans Firebase Console :

- **Authentication > Sign-in method** : activer Email/Password ou Google pour commencer. Éviter la connexion SMS au début.
- **Firestore Database** : créer la base en mode production et choisir la région la plus proche de la zone pilote.
- **Hosting** : initialiser Firebase Hosting lorsque le projet est prêt.

## Étape 3 — Déployer depuis un ordinateur

Depuis la racine du dépôt :

```bash
pnpm install --frozen-lockfile
pnpm build:static
pnpm dlx firebase-tools login
pnpm dlx firebase-tools use --add
pnpm dlx firebase-tools deploy --only hosting,firestore:rules,firestore:indexes
```

Lors de `use --add`, sélectionner le projet Firebase créé à l'étape 1.

Le site sera disponible sur une adresse du type :

```text
https://ID_DU_PROJET.web.app
```

## Étape 4 — Connexion GitHub automatique

Pour publier automatiquement après chaque mise à jour :

```bash
pnpm dlx firebase-tools init hosting:github
```

Suivre les questions affichées et autoriser uniquement le dépôt `arcenekoumba-bot/EAU-RAPIDE` si GitHub propose un choix limité.

## Important sur l'incrément 2

La version actuelle du frontend conserve encore les commandes localement pour préserver la démo. Le passage complet à Firestore nécessite ensuite :

1. installer le SDK Firebase dans le frontend ;
2. remplacer l'authentification actuelle par Firebase Authentication ;
3. enregistrer les commandes dans `orders` ;
4. écouter les commandes en temps réel dans l'espace livreur ;
5. renforcer les règles avec les rôles `client`, `livreur` et `admin` ;
6. tester les règles avec l'émulateur Firebase avant la mise en production.

Ne supprime pas la base MySQL actuelle avant d'avoir validé cette migration sur un projet Firebase de test.
