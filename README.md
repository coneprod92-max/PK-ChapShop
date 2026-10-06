# PK ChapShop 🛍️

PK ChapShop est une marketplace locale pensée pour Parakou et ses environs.

## 🎯 Objectif

Permettre aux utilisateurs de découvrir facilement :

- 🍽️ Restaurants
- 🛍️ Boutiques
- 🏢 Agences
- 🏗️ Entreprises
- 🔧 Garages
- 🛠️ Services

## 🚀 Version actuelle

Le parcours principal est :

Accueil
↓
Commerce
↓
Produits
↓
Panier

## 🛒 Fonctionnalités

- Recherche de commerces
- Filtrage par catégorie
- Affichage des commerces publiés
- Page individuelle d'un commerce
- Catalogue de produits
- Ajout au panier
- Modification des quantités
- Suppression des produits
- Compteur du panier
- Stockage temporaire du panier dans le navigateur

## 🗄️ Backend

Le projet utilise Supabase.

Tables principales :

- store_categories
- stores
- products
- customers
- orders
- order_items
- deliveries

## 🔐 Sécurité

Les données clients et commandes ne doivent jamais être exposées publiquement.

Les règles RLS Supabase seront renforcées avant l'ouverture des commandes.

## 📦 Prochaines étapes

1. Formulaire de commande
2. Création sécurisée des commandes
3. Paiement
4. Livraison
5. Suivi de livraison
6. Espace commerçant
7. Espace livreur
8. Administration

## 🌍 Déploiement

Le frontend est prévu pour GitHub Pages.

PK ChapShop — Le commerce local, simplement.
