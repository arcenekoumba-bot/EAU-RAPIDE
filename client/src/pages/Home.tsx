import { useEffect, useMemo, useRef, useState } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";
import {
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Droplets,
  Heart,
  MapPin,
  LogOut,
  Menu,
  MessageCircle,
  Navigation,
  PackageCheck,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Star,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";
import {
  createFirebaseOrder,
  firebaseAuth,
  loginWithEmail,
  observeDriverOrders,
  observeDriverProfile,
  observeCustomerOrders,
  observeAvailableDrivers,
  observeFirebaseUser,
  registerWithEmail,
  saveDriverProfile,
  setDriverAvailability,
  logoutFromFirebase,
  updateFirebaseOrderStatus,
  type FirebaseDriver,
  type FirebaseOrder,
  observeCustomerSettings,
  saveCustomerSettings,
  type CustomerSettings,
} from "@/lib/firebase";

type Tab = "accueil" | "commandes" | "profil";
type Mode = "client" | "livreur";
type OrderStatus = "Demandée" | "Acceptée" | "En route" | "Livrée" | "Annulée";

type Livreur = {
  id: string;
  name: string;
  zone: string;
  distance: number;
  rating: number;
  deliveries: number;
  product: string;
  unitPrice: number;
  eta: string;
  verified: boolean;
  phone: string;
};

type Order = {
  id: string;
  livreur: Livreur;
  quantity: number;
  address: string;
  total: number;
  status: OrderStatus;
  createdAt: string;
};

const fallbackLivreurs: Livreur[] = [
  { id: "liv-001", name: "Michaël N.", zone: "Akanda · La Sablière", distance: 0.8, rating: 4.9, deliveries: 126, product: "Bidon 20 L", unitPrice: 2500, eta: "15–25 min", verified: true, phone: "+241 06 20 14 88" },
  { id: "liv-002", name: "Grâce Services", zone: "Av. Jean-Paul II", distance: 1.6, rating: 4.8, deliveries: 89, product: "Bidon 20 L", unitPrice: 2300, eta: "20–30 min", verified: true, phone: "+241 07 42 11 03" },
  { id: "liv-003", name: "Eau Claire Express", zone: "Angondjé · Centre", distance: 2.4, rating: 4.7, deliveries: 64, product: "Pack bouteilles", unitPrice: 4500, eta: "25–35 min", verified: true, phone: "+241 06 98 73 10" },
];

const statusStyles: Record<OrderStatus, string> = {
  Demandée: "status-requested",
  Acceptée: "status-accepted",
  "En route": "status-route",
  Livrée: "status-delivered",
  Annulée: "status-cancelled",
};

const formatPrice = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`;

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <Droplets size={19} strokeWidth={2.7} />
    </div>
  );
}

function Header({ userName, onLogin, onOpenMenu }: { userName?: string | null; onLogin: () => void; onOpenMenu: () => void }) {
  return (
    <header className="topbar">
      <div className="topbar-row">
        <div className="brand-lockup">
          <BrandMark />
          <div>
            <div className="brand-name">Eau Rapide</div>
            <div className="brand-subtitle">L’eau près de vous</div>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="icon-button inverse" onClick={onOpenMenu} aria-label="Ouvrir le menu"><Menu size={19} /></button>
          {userName ? (
            <div className="avatar-chip" title={userName}>{userName.slice(0, 1).toUpperCase()}</div>
          ) : (
            <button className="login-link" onClick={onLogin}>Se connecter</button>
          )}
        </div>
      </div>
    </header>
  );
}

function BottomNav({ activeTab, onChange }: { activeTab: Tab; onChange: (tab: Tab) => void }) {
  const items: Array<{ id: Tab; label: string; icon: typeof Navigation }> = [
    { id: "accueil", label: "Accueil", icon: Navigation },
    { id: "commandes", label: "Commandes", icon: PackageCheck },
    { id: "profil", label: "Mon espace", icon: UserRound },
  ];
  return (
    <nav className="bottom-nav" aria-label="Navigation principale">
      {items.map(({ id, label, icon: Icon }) => (
        <button key={id} className={activeTab === id ? "nav-item active" : "nav-item"} onClick={() => onChange(id)}>
          <Icon size={19} strokeWidth={activeTab === id ? 2.5 : 2} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function LivreurCard({ livreur, onOrder, isFavorite, onToggleFavorite }: { livreur: Livreur; onOrder: (livreur: Livreur) => void; isFavorite: boolean; onToggleFavorite: (id: string) => void }) {
  return (
    <article className="livreur-card">
      <div className="livreur-card-head">
        <div className="livreur-avatar">{livreur.name.slice(0, 1)}</div>
        <div className="livreur-identity">
          <div className="identity-line">
            <h3>{livreur.name}</h3>
            {livreur.verified && <ShieldCheck size={15} className="verified-icon" aria-label="Livreur vérifié" />}
          </div>
          <p>{livreur.zone}</p>
        </div>
        <div className="distance-pill"><Navigation size={13} /> {livreur.distance > 0 ? `${livreur.distance.toFixed(1)} km` : livreur.zone}</div>
      </div>
      <div className="livreur-meta-row">
        {livreur.rating > 0 && <span className="rating"><Star size={14} fill="currentColor" /> {livreur.rating.toFixed(1)} <small>({livreur.deliveries})</small></span>}
        <span className="eta"><Clock3 size={14} /> {livreur.eta}</span>
        <span>{livreur.product}</span>
      </div>
      <div className="livreur-card-bottom">
        <div>
          <span className="price-label">à partir de</span>
          <strong>{formatPrice(livreur.unitPrice)}</strong>
        </div>
        <div className="card-actions">
          <a className="round-action" href={`tel:${livreur.phone.replaceAll(" ", "")}`} aria-label={`Appeler ${livreur.name}`}><Phone size={17} /></a>
          <a className="round-action" href={`https://wa.me/${livreur.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" aria-label={`Écrire à ${livreur.name}`}><MessageCircle size={17} /></a>
          <button className="round-action" onClick={() => onToggleFavorite(livreur.id)} aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"} aria-pressed={isFavorite}><Heart size={16} fill={isFavorite ? "currentColor" : "none"} /></button><button className="primary-small" onClick={() => onOrder(livreur)}>Commander <ArrowRight size={15} /></button>
        </div>
      </div>
    </article>
  );
}

function OrderModal({ livreur, onClose, onConfirm, defaultAddress }: { livreur: Livreur; onClose: () => void; onConfirm: (quantity: number, address: string) => void; defaultAddress: string }) {
  const [quantity, setQuantity] = useState(1);
  const [address, setAddress] = useState(defaultAddress || "");
  const deliveryFee = 1000;
  const total = livreur.unitPrice * quantity + deliveryFee;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="order-modal" role="dialog" aria-modal="true" aria-labelledby="order-title">
        <div className="modal-head">
          <div><span className="eyebrow">Nouvelle commande</span><h2 id="order-title">Commander auprès de {livreur.name}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Fermer"><X size={19} /></button>
        </div>
        <div className="selected-supplier"><div className="livreur-avatar small">{livreur.name.slice(0, 1)}</div><div><strong>{livreur.product}</strong><span><Star size={13} fill="currentColor" /> {livreur.rating.toFixed(1)} · {livreur.eta}</span></div><span className="supplier-price">{formatPrice(livreur.unitPrice)}</span></div>
        <label className="field-label" htmlFor="quantity">Quantité de contenants</label>
        <div className="quantity-control"><button onClick={() => setQuantity(value => Math.max(1, value - 1))} aria-label="Réduire la quantité">−</button><strong>{quantity}</strong><button onClick={() => setQuantity(value => value + 1)} aria-label="Augmenter la quantité">+</button></div>
        <label className="field-label" htmlFor="address">Lieu de livraison</label>
        <div className="input-with-icon"><MapPin size={17} /><input id="address" value={address} onChange={event => setAddress(event.target.value)} placeholder="Quartier ou adresse" /></div>
        <div className="price-summary"><div><span>{livreur.product} × {quantity}</span><strong>{formatPrice(livreur.unitPrice * quantity)}</strong></div><div><span>Frais de livraison</span><strong>{formatPrice(deliveryFee)}</strong></div><div className="summary-total"><span>Total à la livraison</span><strong>{formatPrice(total)}</strong></div></div>
        <button className="primary-button full" onClick={() => onConfirm(quantity, address)} disabled={!address.trim()}><Check size={17} /> Confirmer la demande</button>
        <p className="modal-note">Paiement à la livraison · La commande sera confirmée par le livreur.</p>
      </section>
    </div>
  );
}

function ClientHome({ livreurs, onOrder, onLocate, locationLabel, favoriteIds, onToggleFavorite }: { livreurs: Livreur[]; onOrder: (livreur: Livreur) => void; onLocate: () => void; locationLabel: string; favoriteIds: string[]; onToggleFavorite: (id: string) => void }) {
  return (
    <>
      <section className="welcome-row">
        <div><span className="eyebrow">Bonjour, bienvenue</span><h1>De l’eau, <em>sans détour.</em></h1></div>
      </section>
      <button className="location-bar" onClick={onLocate}><span className="location-icon"><MapPin size={17} /></span><span><small>Livrer à</small><strong>{locationLabel}</strong></span><ChevronRight size={18} /></button>
      <section className="hero-card">
        <div className="hero-copy"><span className="hero-kicker"><span className="pulse-dot" /> {livreurs.length} livreur{livreurs.length > 1 ? "s" : ""} disponible{livreurs.length > 1 ? "s" : ""}</span><h2>Votre réserve ne devrait jamais être vide.</h2><p>Trouvez de l’eau potable et faites-vous livrer simplement, près de chez vous.</p><button className="light-button" onClick={onLocate}>Voir les livreurs <ArrowRight size={16} /></button></div>
        <div className="hero-art" aria-hidden="true"><Droplets size={92} strokeWidth={1.2} /><div className="hero-ripple ripple-one" /><div className="hero-ripple ripple-two" /></div>
      </section>
      <section className="quick-stats"><div><strong>15–25</strong><span>min moyen</span></div><div><strong>4.8/5</strong><span>note service</span></div><div><strong>7j/7</strong><span>disponible</span></div></section>
      <section className="section-block"><div className="section-heading"><div><span className="eyebrow">À proximité</span><h2>Livreurs disponibles</h2></div><button className="text-button" onClick={onLocate}><Search size={15} /> Rechercher</button></div><div className="list-stack">{livreurs.map(livreur => <LivreurCard key={livreur.id} livreur={livreur} onOrder={onOrder} isFavorite={favoriteIds.includes(livreur.id)} onToggleFavorite={onToggleFavorite} />)}{livreurs.length === 0 && <div className="empty-state compact"><div className="empty-icon"><Truck size={24} /></div><h2>Aucun livreur disponible pour le moment</h2><p>Les livreurs inscrits et connectés apparaîtront ici dès qu’ils auront publié leur profil.</p></div>}</div></section>
      <section className="trust-strip"><ShieldCheck size={21} /><div><strong>Des livreurs vérifiés</strong><span>Chaque profil est contrôlé avant d’être visible.</span></div><ChevronRight size={17} /></section>
      <p className="pilot-note"><CheckCircle2 size={14} /> Mode pilote : les commandes restent enregistrées sur ce téléphone.</p>
    </>
  );
}

function OrdersView({ orders, onAdvance, onCancel }: { orders: Order[]; onAdvance: (id: string) => void; onCancel: (id: string) => void }) {
  return (
    <section className="page-section"><div className="page-heading"><div><span className="eyebrow">Votre activité</span><h1>Mes commandes</h1></div><button className="icon-button"><Bell size={18} /></button></div>{orders.length === 0 ? <div className="empty-state"><div className="empty-icon"><ShoppingBag size={25} /></div><h2>Aucune commande pour le moment</h2><p>Votre prochaine livraison d’eau apparaîtra ici.</p></div> : <div className="list-stack">{orders.map(order => <article className="order-card" key={order.id}><div className="order-card-top"><div><span className="eyebrow">Commande #{order.id.slice(-4)}</span><h2>{order.livreur.name}</h2></div><span className={`status-pill ${statusStyles[order.status]}`}>{order.status}</span></div><div className="order-route"><MapPin size={15} /><span>{order.address}</span><ChevronRight size={16} /></div><div className="order-details"><span>{order.quantity} × {order.livreur.product}</span><strong>{formatPrice(order.total)}</strong></div><div className="order-timeline"><span className={order.status !== "Annulée" ? "timeline-dot done" : "timeline-dot"} /><span className="timeline-line" /><span className={order.status === "Acceptée" || order.status === "En route" || order.status === "Livrée" ? "timeline-dot done" : "timeline-dot"} /><span className="timeline-line" /><span className={order.status === "En route" || order.status === "Livrée" ? "timeline-dot done" : "timeline-dot"} /><span className="timeline-line" /><span className={order.status === "Livrée" ? "timeline-dot done" : "timeline-dot"} /></div><div className="timeline-labels"><span>Demande</span><span>Acceptée</span><span>En route</span><span>Livrée</span></div>{order.status === "Livrée" ? <div className="rating-row"><span>Votre avis</span><span className="stars"><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} /></span></div> : order.status !== "Annulée" ? <div className="order-actions"><button className="secondary-small" onClick={() => onAdvance(order.id)}>{order.status === "Demandée" ? "Simuler l’acceptation" : order.status === "Acceptée" ? "Simuler le départ" : "Simuler la livraison"}</button><button className="ghost-small" onClick={() => onCancel(order.id)}>Annuler</button></div> : null}</article>)}</div>}</section>
  );
}

function DriverView({ onLogin, userId }: { onLogin: () => void; userId?: string }) {
  const [profile, setProfile] = useState<FirebaseDriver | null>(null);
  const [orders, setOrders] = useState<FirebaseOrder[]>([]);
  const [form, setForm] = useState({ name: "", zone: "", phone: "", product: "Bidon 20 L", unitPrice: "2500" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const stopProfile = observeDriverProfile(userId, nextProfile => {
      setProfile(nextProfile);
      if (nextProfile) setForm({ name: nextProfile.name, zone: nextProfile.zone, phone: nextProfile.phone, product: nextProfile.product, unitPrice: String(nextProfile.unitPrice) });
      else {
        const accountEmail = firebaseAuth.currentUser?.email || "";
        const phoneMatch = accountEmail.match(/^(241\\d{8})@phone\\.eaurapide\\.app$/);
        if (phoneMatch) setForm(current => ({ ...current, phone: `+${phoneMatch[1]}` }));
      }
    });
    const stopOrders = observeDriverOrders(userId, setOrders);
    return () => { stopProfile(); stopOrders(); };
  }, [userId]);

  if (!userId) return <section className="page-section"><div className="page-heading"><div><span className="eyebrow">Espace partenaire</span><h1>Je suis livreur</h1></div></div><div className="driver-hero"><div className="driver-hero-icon"><Truck size={27} /></div><div><span className="eyebrow">Gagnez du temps, livrez mieux</span><h2>Recevez les demandes autour de vous.</h2><p>Connectez-vous pour créer votre profil et recevoir les commandes proches.</p></div></div><article className="driver-onboarding"><div className="onboarding-icon"><UserRound size={20} /></div><div><h2>Accéder à mon espace</h2><p>Votre profil et vos commandes seront protégés par votre compte.</p></div><button className="primary-small" onClick={onLogin}>Se connecter</button></article></section>;

  const save = async () => {
    const unitPrice = Number(form.unitPrice);
    if (!form.name.trim() || !form.zone.trim() || !form.phone.trim() || !unitPrice || unitPrice < 1) {
      toast.error("Complétez votre nom, votre zone, votre téléphone et votre tarif.");
      return;
    }
    setSaving(true);
    try {
      await saveDriverProfile(userId, { name: form.name.trim(), zone: form.zone.trim(), phone: form.phone.trim(), product: form.product.trim() || "Bidon 20 L", unitPrice, available: profile?.available ?? true });
      toast.success("Profil livreur publié", { description: "Votre profil est maintenant visible par les clients lorsque vous êtes disponible." });
    } catch {
      toast.error("Impossible d’enregistrer le profil pour le moment.");
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailability = async () => {
    if (!profile) {
      toast.error("Enregistrez d’abord votre profil.");
      return;
    }
    try {
      await setDriverAvailability(userId, !profile.available);
    } catch {
      toast.error("Impossible de modifier votre disponibilité.");
    }
  };

  return <section className="page-section"><div className="page-heading"><div><span className="eyebrow">Espace partenaire</span><h1>Je suis livreur</h1></div><span className={profile?.approved ? "status-pill status-delivered" : "status-pill status-requested"}>{profile?.approved ? "Profil publié" : "À publier"}</span></div><div className="driver-hero"><div className="driver-hero-icon"><Truck size={27} /></div><div><span className="eyebrow">Votre activité</span><h2>Recevez les demandes autour de vous.</h2><p>Votre disponibilité reste sous votre contrôle. La position exacte du client n’est visible qu’avec une commande.</p></div></div><article className="availability-card"><div><span className="eyebrow">Statut en direct</span><h2>{profile?.available ? "Vous êtes visible" : "Vous êtes hors ligne"}</h2><p>{profile?.available ? "Les clients peuvent vous trouver dans votre zone." : "Enregistrez votre profil puis activez votre disponibilité."}</p></div><button className={profile?.available ? "availability-toggle on" : "availability-toggle"} onClick={() => void toggleAvailability()} aria-pressed={profile?.available ?? false}><span /></button></article><article className="driver-form-card"><div className="section-heading"><div><span className="eyebrow">Votre profil</span><h2>{profile ? "Modifier mes informations" : "Créer mon profil"}</h2></div><ShieldCheck size={19} className="verified-icon" /></div><label className="field-label" htmlFor="driver-name">Nom affiché</label><input id="driver-name" className="text-input" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="Ex. Grâce Services" /><label className="field-label" htmlFor="driver-zone">Zone de livraison</label><input id="driver-zone" className="text-input" value={form.zone} onChange={event => setForm(current => ({ ...current, zone: event.target.value }))} placeholder="Ex. Akanda · La Sablière" /><label className="field-label" htmlFor="driver-phone">Téléphone WhatsApp</label><input id="driver-phone" className="text-input" type="tel" value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} placeholder="+241 ..." /><div className="form-row"><div><label className="field-label" htmlFor="driver-product">Contenant</label><input id="driver-product" className="text-input" value={form.product} onChange={event => setForm(current => ({ ...current, product: event.target.value }))} /></div><div><label className="field-label" htmlFor="driver-price">Prix FCFA</label><input id="driver-price" className="text-input" type="number" min="1" value={form.unitPrice} onChange={event => setForm(current => ({ ...current, unitPrice: event.target.value }))} /></div></div><button className="primary-button full" onClick={() => void save()} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer mon profil"}</button><p className="modal-note">Votre profil est publié dès son enregistrement. Vous pouvez désactiver votre disponibilité à tout moment.</p></article><section className="section-block driver-orders"><div className="section-heading"><div><span className="eyebrow">Commandes reçues</span><h2>{orders.length ? `${orders.length} demande${orders.length > 1 ? "s" : ""}` : "Aucune demande"}</h2></div><Bell size={18} color="var(--lagoon)" /></div>{orders.length === 0 ? <div className="empty-state compact"><div className="empty-icon"><PackageCheck size={24} /></div><p>Les nouvelles commandes ciblant votre profil apparaîtront ici.</p></div> : <div className="list-stack">{orders.map(order => <article className="order-card" key={order.id}><div className="order-card-top"><div><span className="eyebrow">Nouvelle demande</span><h2>{String(order.livreur.name || "Client Eau Rapide")}</h2></div><span className={`status-pill ${statusStyles[order.status as OrderStatus] || "status-requested"}`}>{order.status}</span></div><div className="order-route"><MapPin size={15} /><span>{order.address}</span></div><div className="order-details"><span>{order.quantity} × {String(order.livreur.product || "Eau")}</span><strong>{formatPrice(order.total)}</strong></div>{order.status !== "Livrée" && order.status !== "Annulée" && <div className="order-actions"><button className="secondary-small" onClick={() => void updateFirebaseOrderStatus(order.id!, order.status === "Demandée" ? "Acceptée" : order.status === "Acceptée" ? "En route" : "Livrée")}>{order.status === "Demandée" ? "Accepter" : order.status === "Acceptée" ? "Partir en livraison" : "Confirmer la livraison"}</button>{order.status === "Demandée" && <button className="ghost-small" onClick={() => void updateFirebaseOrderStatus(order.id!, "Annulée")}>Refuser</button>}</div>}</article>)}</div>}</section><p className="fine-print">Les commandes et votre disponibilité sont synchronisées avec Firebase.</p></section>;
}

function ProfileView({ userName, onLogin, onOpenSettings }: { userName?: string | null; onLogin: () => void; onOpenSettings: (section: SettingsSection) => void }) {
  return <section className="page-section"><div className="page-heading"><div><span className="eyebrow">Compte</span><h1>Mon espace</h1></div></div><article className="profile-card"><div className="profile-avatar">{userName ? userName.slice(0, 1).toUpperCase() : <UserRound size={24} />}</div><div><h2>{userName || "Visiteur"}</h2><p>{userName ? "Compte Eau Rapide actif" : "Connectez-vous pour synchroniser vos commandes"}</p></div>{!userName && <button className="primary-small" onClick={onLogin}>Se connecter</button>}</article><div className="settings-list"><button onClick={() => onOpenSettings("addresses")}><div className="setting-icon"><MapPin size={17} /></div><div><strong>Mes adresses</strong><span>Gérer vos lieux de livraison</span></div><ChevronRight size={17} /></button><button onClick={() => onOpenSettings("favorites")}><div className="setting-icon"><Heart size={17} /></div><div><strong>Mes livreurs favoris</strong><span>Retrouvez vos contacts préférés</span></div><ChevronRight size={17} /></button><button onClick={() => onOpenSettings("privacy")}><div className="setting-icon"><ShieldCheck size={17} /></div><div><strong>Confidentialité</strong><span>Vos données et votre position</span></div><ChevronRight size={17} /></button></div><div className="account-note"><CheckCircle2 size={17} /><span>Version pilote · Paiement à la livraison</span></div></section>;
}

type SettingsSection = "addresses" | "favorites" | "privacy";

function AccountSettingsModal({ section, settings, livreurs, onClose, onSave }: {
  section: SettingsSection;
  settings: CustomerSettings;
  livreurs: Livreur[];
  onClose: () => void;
  onSave: (next: CustomerSettings) => Promise<void>;
}) {
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const title = section === "addresses" ? "Mes adresses" : section === "favorites" ? "Mes livreurs favoris" : "Confidentialité";
  const update = async (next: CustomerSettings) => {
    setSaving(true);
    try { await onSave(next); }
    catch { /* Le parent affiche le message d’erreur. */ }
    finally { setSaving(false); }
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="order-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className="modal-head"><div><span className="eyebrow">Mon compte</span><h2 id="settings-title">{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Fermer"><X size={19} /></button></div>
      {section === "addresses" ? <>
        <p className="modal-note">Enregistrez vos lieux habituels pour les retrouver rapidement lors d’une commande.</p>
        <label className="field-label" htmlFor="saved-address">Nouvelle adresse</label>
        <div className="input-with-icon"><MapPin size={17} /><input id="saved-address" value={address} onChange={event => setAddress(event.target.value)} placeholder="Quartier, rue, repère…" /></div>
        <button className="primary-button full" disabled={saving || !address.trim()} onClick={() => { const nextAddress = address.trim(); void update({ ...settings, addresses: [...settings.addresses.filter(item => item !== nextAddress), nextAddress], defaultAddress: settings.defaultAddress || nextAddress }).then(() => setAddress("")); }}>Ajouter cette adresse</button>
        <div className="list-stack settings-modal-list">{settings.addresses.map(item => <article className="order-card" key={item}><div className="order-card-top"><strong>{item}</strong>{settings.defaultAddress === item && <span className="status-pill status-delivered">Principale</span>}</div><div className="order-actions">{settings.defaultAddress !== item && <button className="secondary-small" disabled={saving} onClick={() => void update({ ...settings, defaultAddress: item })}>Définir principale</button>}<button className="ghost-small" disabled={saving} onClick={() => void update({ ...settings, addresses: settings.addresses.filter(value => value !== item), defaultAddress: settings.defaultAddress === item ? settings.addresses.find(value => value !== item) || "" : settings.defaultAddress })}>Supprimer</button></div></article>)}{settings.addresses.length === 0 && <div className="empty-state compact"><p>Aucune adresse enregistrée pour le moment.</p></div>}</div>
      </> : section === "favorites" ? <>
        <p className="modal-note">Retrouvez ici les livreurs que vous avez ajoutés avec le cœur sur leur fiche.</p>
        <div className="list-stack settings-modal-list">{settings.favoriteDriverIds.map(id => { const driver = livreurs.find(item => item.id === id); return <article className="order-card" key={id}><div className="order-card-top"><div><strong>{driver?.name || "Livreur indisponible"}</strong><p className="modal-note">{driver?.zone || "Ce profil n’est plus publié."}</p></div><Heart size={18} fill="currentColor" color="var(--lagoon)" /></div><button className="ghost-small" disabled={saving} onClick={() => void update({ ...settings, favoriteDriverIds: settings.favoriteDriverIds.filter(value => value !== id) })}>Retirer des favoris</button></article>})}{settings.favoriteDriverIds.length === 0 && <div className="empty-state compact"><p>Vous n’avez pas encore de livreur favori. Touchez le cœur sur une fiche livreur pour l’ajouter.</p></div>}</div>
      </> : <>
        <p className="modal-note">Eau Rapide utilise uniquement les informations nécessaires au fonctionnement du service.</p>
        <article className="order-card"><strong>Informations du compte</strong><p className="modal-note">Votre identifiant Firebase sert à protéger votre compte et synchroniser vos informations.</p></article>
        <article className="order-card"><strong>Adresses de livraison</strong><p className="modal-note">Les adresses que vous enregistrez sont conservées dans votre espace et utilisées lorsque vous préparez une commande.</p></article>
        <article className="order-card"><strong>Position GPS</strong><p className="modal-note">La position n’est demandée que lorsque vous appuyez sur la recherche de proximité. Vous pouvez refuser l’autorisation dans les réglages de votre téléphone.</p></article>
        <article className="order-card"><strong>Vos choix</strong><p className="modal-note">Vous pouvez modifier ou supprimer vos adresses et vos livreurs favoris depuis cette page. Nous n’affichons pas votre position exacte publiquement.</p></article>
      </>}
      <button className="secondary-small full" onClick={onClose}>Fermer</button>
    </section>
  </div>;
}

function AuthModal({ onClose }: { onClose: () => void }) {
  const [method, setMethod] = useState<"phone" | "email" | "phonePin">("email");
  const [pinPhone, setPinPhone] = useState("");
  const [pin, setPin] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverZone, setDriverZone] = useState("");
  const [driverProduct, setDriverProduct] = useState("Bidon 20 L");
  const [driverPrice, setDriverPrice] = useState("2500");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => () => {
    verifierRef.current?.clear();
    verifierRef.current = null;
  }, []);

  const sendCode = async () => {
    const digits = phone.replace(/\D/g, "").replace(/^241/, "");
    if (digits.length !== 8) {
      toast.error("Entrez un numéro gabonais valide à 8 chiffres.");
      return;
    }
    setBusy(true);
    try {
      firebaseAuth.languageCode = "fr";
      if (!verifierRef.current) {
        verifierRef.current = new RecaptchaVerifier(firebaseAuth, "phone-send-code", { size: "invisible" });
      }
      const result = await signInWithPhoneNumber(firebaseAuth, `+241${digits}`, verifierRef.current);
      setConfirmation(result);
      toast.success("Code envoyé par SMS", { description: "Saisissez les 6 chiffres reçus sur votre téléphone." });
    } catch (error) {
      verifierRef.current?.clear();
      verifierRef.current = null;
      const message = error instanceof Error ? error.message : "";
      if (message.includes("auth/too-many-requests")) toast.error("Trop de tentatives. Réessayez un peu plus tard.");
      else if (message.includes("auth/invalid-phone-number")) toast.error("Ce numéro de téléphone n’est pas valide.");
      else toast.error("Le SMS n’a pas pu être envoyé. Vérifiez votre connexion et réessayez.");
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (!confirmation || !/^\d{6}$/.test(code.trim())) {
      toast.error("Entrez le code à 6 chiffres reçu par SMS.");
      return;
    }
    setBusy(true);
    try {
      await confirmation.confirm(code.trim());
      toast.success("Connexion réussie !");
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast.error(message.includes("auth/invalid-verification-code") ? "Code incorrect. Vérifiez le SMS reçu." : "Impossible de vérifier ce code. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  const normalizeGabonPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").replace(/^241/, "");
    return digits.length === 8 ? `+241${digits}` : "";
  };

  const submitPhonePin = async () => {
    const normalized = normalizeGabonPhone(pinPhone);
    if (!normalized) { toast.error("Entrez un numéro gabonais valide à 8 chiffres."); return; }
    if (!/^\d{6,}$/.test(pin)) { toast.error("Le code PIN doit contenir au moins 6 chiffres."); return; }
    if (register && (!driverName.trim() || !driverZone.trim() || !driverProduct.trim() || !Number.isFinite(Number(driverPrice)) || Number(driverPrice) < 1)) {
      toast.error("Complétez votre nom, votre zone, votre produit et votre tarif.");
      return;
    }
    setBusy(true);
    try {
      const phoneEmail = `${normalized.replace(/\+/g, "")}@phone.eaurapide.app`;
      if (register) {
        await registerWithEmail(phoneEmail, pin);
        const uid = firebaseAuth.currentUser?.uid;
        if (!uid) throw new Error("auth/user-not-found");
        await saveDriverProfile(uid, { name: driverName.trim(), zone: driverZone.trim(), phone: normalized, product: driverProduct.trim(), unitPrice: Number(driverPrice), available: true });
      } else await loginWithEmail(phoneEmail, pin);
      toast.success(register ? "Compte et profil livreur créés !" : "Connexion réussie !");
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("auth/email-already-in-use")) toast.error("Ce numéro possède déjà un compte. Connectez-vous.");
      else if (message.includes("auth/invalid-credential") || message.includes("auth/user-not-found")) toast.error("Numéro ou PIN incorrect.");
      else if (message.includes("auth/weak-password")) toast.error("Choisissez un PIN plus long.");
      else toast.error("Impossible de créer le compte ou de se connecter.");
    } finally { setBusy(false); }
  };

  const submitEmail = async () => {
    if (!email || password.length < 6) {
      toast.error("Renseignez un e-mail et un mot de passe d’au moins 6 caractères.");
      return;
    }
    setBusy(true);
    try {
      if (register) await registerWithEmail(email, password);
      else await loginWithEmail(email, password);
      toast.success(register ? "Compte créé" : "Connexion réussie");
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast.error(message.includes("auth/invalid-credential") ? "E-mail ou mot de passe incorrect." : "Impossible de se connecter pour le moment.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="order-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <div className="modal-head"><div><span className="eyebrow">Eau Rapide</span><h2 id="auth-title">{method === "phone" ? (confirmation ? "Vérifier mon numéro" : "Connexion par SMS") : (register ? "Créer mon compte" : "Connexion par e-mail")}</h2></div><button className="icon-button" onClick={onClose} aria-label="Fermer"><X size={19} /></button></div>
      {method === "phonePin" ? <>
        <div className="phone-pin-intro"><strong>Inscription simple et sans SMS</strong><span>Votre numéro et votre code PIN vous permettront de vous connecter. Choisissez un PIN personnel d’au moins 6 chiffres.</span></div>
        <label className="field-label" htmlFor="pin-phone">Numéro de téléphone</label>
        <div className="phone-auth-input"><span>🇬🇦 +241</span><input id="pin-phone" className="text-input" type="tel" inputMode="numeric" value={pinPhone} onChange={event => setPinPhone(event.target.value.replace(/[^0-9\\s]/g, "").slice(0, 12))} placeholder="06 12 34 56" autoComplete="tel-national" /></div>
        {register && <>
          <div className="signup-section-title">Votre profil livreur</div>
          <label className="field-label" htmlFor="signup-driver-name">Nom et prénom</label>
          <input id="signup-driver-name" className="text-input" value={driverName} onChange={event => setDriverName(event.target.value)} placeholder="Ex. Grâce Moussavou" autoComplete="name" />
          <label className="field-label" htmlFor="signup-driver-zone">Zone de livraison</label>
          <input id="signup-driver-zone" className="text-input" value={driverZone} onChange={event => setDriverZone(event.target.value)} placeholder="Ex. Akanda · La Sablière" />
          <label className="field-label" htmlFor="signup-driver-product">Produit proposé</label>
          <input id="signup-driver-product" className="text-input" value={driverProduct} onChange={event => setDriverProduct(event.target.value)} placeholder="Ex. Bidon 20 L" />
          <label className="field-label" htmlFor="signup-driver-price">Prix par contenant (FCFA)</label>
          <input id="signup-driver-price" className="text-input" type="number" min="1" inputMode="numeric" value={driverPrice} onChange={event => setDriverPrice(event.target.value)} />
        </>}
        <label className="field-label" htmlFor="driver-pin">{register ? "Créer mon code PIN (6 chiffres minimum)" : "Mon code PIN"}</label>
        <input id="driver-pin" className="text-input" type="password" inputMode="numeric" autoComplete={register ? "new-password" : "current-password"} value={pin} onChange={event => setPin(event.target.value.replace(/\\D/g, "").slice(0, 12))} placeholder="••••••" />
        <button className="primary-button full" onClick={() => void submitPhonePin()} disabled={busy}>{busy ? "Création en cours…" : register ? "Créer mon compte complet" : "Se connecter"}</button>
        <button className="text-button auth-switch" onClick={() => setRegister(value => !value)}>{register ? "J’ai déjà un compte" : "Créer un nouveau compte"}</button>
        <button className="text-button auth-switch" onClick={() => setMethod("email")}>Connexion par e-mail</button>
      </> : method === "phone" ? <>
        <p className="modal-note">{confirmation ? `Un code de vérification a été envoyé au +241 ${phone}.` : "Entrez votre numéro de téléphone. Nous vous enverrons un code à 6 chiffres par SMS."}</p>
        {!confirmation ? <>
          <label className="field-label" htmlFor="auth-phone">Numéro de téléphone</label>
          <div className="phone-auth-input"><span>🇬🇦 +241</span><input id="auth-phone" className="text-input" type="tel" inputMode="numeric" autoComplete="tel-national" value={phone} onChange={event => setPhone(event.target.value.replace(/[^0-9\s]/g, "").slice(0, 12))} placeholder="06 12 34 56" /></div>
          <button id="phone-send-code" className="primary-button full" onClick={() => void sendCode()} disabled={busy}>{busy ? "Envoi en cours…" : "Recevoir mon code SMS"}</button>
          <p className="modal-note">Des frais SMS standards peuvent s’appliquer selon votre opérateur.</p>
        </> : <>
          <label className="field-label" htmlFor="auth-code">Code de vérification</label>
          <input id="auth-code" className="text-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="••••••" />
          <button className="primary-button full" onClick={() => void verifyCode()} disabled={busy}>{busy ? "Vérification…" : "Valider mon numéro"}</button>
          <button className="text-button auth-switch" onClick={() => { setConfirmation(null); setCode(""); }}>Modifier le numéro</button>
          <button className="text-button auth-switch" onClick={() => void sendCode()} disabled={busy}>Renvoyer le code</button>
        </>}
        <button className="text-button auth-switch" onClick={() => setMethod("email")}>J’ai déjà un compte e-mail</button>
        <div id="phone-auth-recaptcha" />
      </> : <>
        <p className="modal-note">Vous pouvez toujours utiliser votre ancien compte e-mail et mot de passe.</p>
        <label className="field-label" htmlFor="auth-email">Adresse e-mail</label>
        <input id="auth-email" className="text-input" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="vous@example.com" autoComplete="email" />
        <label className="field-label" htmlFor="auth-password">Mot de passe</label>
        <input id="auth-password" className="text-input" type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="6 caractères minimum" autoComplete={register ? "new-password" : "current-password"} />
        <button className="primary-button full" onClick={() => void submitEmail()} disabled={busy}>{busy ? "Patientez…" : register ? "Créer mon compte" : "Se connecter"}</button>
        <button className="text-button auth-switch" onClick={() => setRegister(value => !value)}>{register ? "J’ai déjà un compte" : "Créer un compte gratuitement"}</button>
        <button className="text-button auth-switch" onClick={() => { setMethod("phonePin"); setRegister(true); }}>Créer mon compte livreur avec numéro + PIN</button>
        <button className="text-button auth-switch" onClick={() => { setMethod("phonePin"); setRegister(false); }}>Connexion livreur par numéro + PIN</button>
      </>}
    </section>
  </div>;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("accueil");
  const [mode, setMode] = useState<Mode>("client");
  const [locationLabel, setLocationLabel] = useState("Akanda, Libreville");
  const [selectedLivreur, setSelectedLivreur] = useState<Livreur | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<{ uid: string; email?: string | null; phoneNumber?: string | null } | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection | null>(null);
  const [customerSettings, setCustomerSettings] = useState<CustomerSettings>({ addresses: [], defaultAddress: "", favoriteDriverIds: [] });
  const [orders, setOrders] = useState<Order[]>(() => {
    try { return JSON.parse(localStorage.getItem("eau-rapide-orders") || "[]") as Order[]; } catch { return []; }
  });
  const { data: user } = trpc.auth.me.useQuery();
  const livreursQuery = trpc.marketplace.livreurs.useQuery();
  const [availableDrivers, setAvailableDrivers] = useState<FirebaseDriver[]>([]);
  const [signedInDriverProfile, setSignedInDriverProfile] = useState<FirebaseDriver | null>(null);
  useEffect(() => observeAvailableDrivers(setAvailableDrivers), []);
  useEffect(() => {
    if (!firebaseUser) { setSignedInDriverProfile(null); return; }
    return observeDriverProfile(firebaseUser.uid, setSignedInDriverProfile);
  }, [firebaseUser]);
  const livreurs = useMemo(() => {
    if (availableDrivers.length) {
      return availableDrivers.map(driver => ({
        id: driver.id || "",
        name: driver.name,
        zone: driver.zone,
        distance: 0,
        rating: driver.rating || 0,
        deliveries: driver.deliveries || 0,
        product: driver.product,
        unitPrice: driver.unitPrice,
        eta: "À confirmer",
        verified: false,
        phone: driver.phone,
      }));
    }
    return livreursQuery.data?.length ? livreursQuery.data : [];
  }, [availableDrivers, livreursQuery.data]);

  useEffect(() => {
    localStorage.setItem("eau-rapide-orders", JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  useEffect(() => observeFirebaseUser(nextUser => setFirebaseUser(nextUser ? { uid: nextUser.uid, email: nextUser.email, phoneNumber: nextUser.phoneNumber } : null)), []);

  useEffect(() => {
    if (!firebaseUser) { setCustomerSettings({ addresses: [], defaultAddress: "", favoriteDriverIds: [] }); return; }
    return observeCustomerSettings(firebaseUser.uid, setCustomerSettings);
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) return;
    return observeCustomerOrders(firebaseUser.uid, remoteOrders => {
      setOrders(remoteOrders.map(order => ({
        id: order.id || `ER-${Date.now()}`,
        livreur: order.livreur as unknown as Livreur,
        quantity: order.quantity,
        address: order.address,
        total: order.total,
        status: order.status as OrderStatus,
        createdAt: order.createdAt || new Date().toISOString(),
      })));
    });
  }, [firebaseUser]);

  const login = () => {
    setAuthOpen(true);
    setMenuOpen(false);
    setSettingsSection(null);
  };

  const openSettings = (section: SettingsSection) => {
    if (!firebaseUser) { toast("Connectez-vous pour enregistrer vos préférences."); login(); return; }
    setSettingsSection(section);
  };

  const persistCustomerSettings = async (next: CustomerSettings) => {
    if (!firebaseUser) return;
    try { await saveCustomerSettings(firebaseUser.uid, next); setCustomerSettings(next); toast.success("Vos préférences ont été enregistrées."); }
    catch { toast.error("Impossible d’enregistrer vos préférences. Réessayez."); }
  };

  const toggleFavorite = (id: string) => {
    if (!firebaseUser) { toast("Connectez-vous pour conserver vos livreurs favoris."); login(); return; }
    const favoriteDriverIds = customerSettings.favoriteDriverIds.includes(id) ? customerSettings.favoriteDriverIds.filter(value => value !== id) : [...customerSettings.favoriteDriverIds, id];
    void persistCustomerSettings({ ...customerSettings, favoriteDriverIds }).catch(() => undefined);
  };

  const logout = async () => {
    if (!window.confirm("Voulez-vous vraiment vous déconnecter de votre compte Eau Rapide ?")) return;
    try {
      await logoutFromFirebase();
      setMenuOpen(false);
      toast.success("Vous êtes déconnecté(e).");
    } catch {
      toast.error("La déconnexion a échoué. Réessayez.");
    }
  };

  const navigateFromMenu = (destination: "accueil" | "commandes" | "profil" | "livreur") => {
    if (destination === "livreur") {
      setMode("livreur");
      setActiveTab("profil");
    } else {
      setMode("client");
      setActiveTab(destination);
    }
    setMenuOpen(false);
  };

  const locate = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Géolocalisation indisponible", { description: "Choisissez votre quartier pour voir les livreurs." });
      return;
    }
    toast("Recherche de votre position…", { description: "Autorisez la localisation pour affiner les livreurs proches." });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocationLabel("Position GPS détectée");
        toast.success("Position trouvée", { description: `Précision d’environ ${Math.round(coords.accuracy)} m. Nous affichons les livreurs proches.` });
      },
      () => toast.error("Position non disponible", { description: "Vous pouvez continuer en recherchant par quartier." }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  };
  const confirmOrder = async (livreur: Livreur, quantity: number, address: string) => {
    const order: Order = { id: `ER-${Date.now()}`, livreur, quantity, address, total: livreur.unitPrice * quantity + 1000, status: "Demandée", createdAt: new Date().toISOString() };
    if (firebaseUser) {
      try {
        const id = await createFirebaseOrder({ customerId: firebaseUser.uid, driverId: livreur.id, livreur: livreur as unknown as Record<string, unknown>, quantity, address, total: order.total, status: order.status });
        order.id = id;
      } catch {
        toast.error("La commande n’a pas pu être synchronisée.");
        return;
      }
    }
    setOrders(current => [order, ...current]);
    setSelectedLivreur(null);
    setActiveTab("commandes");
    toast.success("Demande envoyée", { description: `${livreur.name} va confirmer votre livraison.` });
  };
  const advanceOrder = (id: string) => {
    const current = orders.find(order => order.id === id);
    if (!current) return;
    const status = current.status === "Demandée" ? "Acceptée" : current.status === "Acceptée" ? "En route" : "Livrée";
    if (firebaseUser && !id.startsWith("ER-")) void updateFirebaseOrderStatus(id, status).catch(() => toast.error("Mise à jour impossible"));
    setOrders(list => list.map(order => order.id !== id ? order : { ...order, status }));
  };
  const cancelOrder = (id: string) => { if (firebaseUser && !id.startsWith("ER-")) void updateFirebaseOrderStatus(id, "Annulée"); setOrders(current => current.map(order => order.id === id ? { ...order, status: "Annulée" } : order)); toast("Commande annulée"); };

  const emailDisplay = firebaseUser?.email && !firebaseUser.email.endsWith("@phone.eaurapide.app") ? firebaseUser.email : null;
  const displayName = signedInDriverProfile?.name || user?.name || emailDisplay || firebaseUser?.phoneNumber || (firebaseUser ? "Compte Eau Rapide" : null);
  return <div className="app-shell"><Header userName={displayName} onLogin={login} onOpenMenu={() => setMenuOpen(true)} /><main className="app-main"><div className="mode-switch" role="tablist" aria-label="Type d’espace"><button className={mode === "client" ? "mode-button active" : "mode-button"} onClick={() => { setMode("client"); setActiveTab("accueil"); }}><ShoppingBag size={15} /> Je cherche de l’eau</button><button className={mode === "livreur" ? "mode-button active" : "mode-button"} onClick={() => { setMode("livreur"); setActiveTab("profil"); }}><Truck size={15} /> Je suis livreur</button></div>{mode === "livreur" ? <DriverView onLogin={login} userId={firebaseUser?.uid} /> : activeTab === "accueil" ? <ClientHome livreurs={livreurs} onOrder={setSelectedLivreur} onLocate={locate} locationLabel={locationLabel} favoriteIds={customerSettings.favoriteDriverIds} onToggleFavorite={toggleFavorite} /> : activeTab === "commandes" ? <OrdersView orders={orders} onAdvance={advanceOrder} onCancel={cancelOrder} /> : <ProfileView userName={displayName} onLogin={login} onOpenSettings={openSettings} />}</main><BottomNav activeTab={activeTab} onChange={setActiveTab} />{menuOpen && <div className="account-drawer-backdrop" onClick={() => setMenuOpen(false)}><aside className="account-drawer" role="dialog" aria-modal="true" aria-label="Menu Eau Rapide" onClick={event => event.stopPropagation()}><div className="account-drawer-header"><div className="account-drawer-brand"><BrandMark /><div><strong>Eau Rapide</strong><span>{displayName || "Votre espace"}</span></div></div><button className="icon-button" onClick={() => setMenuOpen(false)} aria-label="Fermer le menu"><X size={19} /></button></div><div className="account-drawer-section"><span className="eyebrow">Navigation</span><button onClick={() => navigateFromMenu("accueil")}><Navigation size={18} /><span>Accueil</span><ChevronRight size={17} /></button><button onClick={() => navigateFromMenu("commandes")}><PackageCheck size={18} /><span>Mes commandes</span><ChevronRight size={17} /></button><button onClick={() => navigateFromMenu("profil")}><UserRound size={18} /><span>Mon espace</span><ChevronRight size={17} /></button><button onClick={() => navigateFromMenu("livreur")}><Truck size={18} /><span>Je suis livreur</span><ChevronRight size={17} /></button></div><div className="account-drawer-section muted-section"><span className="eyebrow">Prochainement</span><div className="drawer-coming-soon"><Bell size={18} /><span>Centre de notifications</span><small>Bientôt</small></div><div className="drawer-coming-soon"><MessageCircle size={18} /><span>Centre d’aide</span><small>Bientôt</small></div></div><div className="account-drawer-footer">{firebaseUser ? <button className="drawer-logout" onClick={() => void logout()}><LogOut size={18} /><span>Déconnexion</span></button> : <button className="drawer-login" onClick={login}><UserRound size={18} /><span>Se connecter</span></button>}<p>Version pilote · Eau Rapide</p></div></aside></div>}{selectedLivreur && <OrderModal livreur={selectedLivreur} onClose={() => setSelectedLivreur(null)} onConfirm={(quantity, address) => void confirmOrder(selectedLivreur, quantity, address)} defaultAddress={customerSettings.defaultAddress} />}{authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}{settingsSection && <AccountSettingsModal section={settingsSection} settings={customerSettings} livreurs={livreurs} onClose={() => setSettingsSection(null)} onSave={persistCustomerSettings} />}</div>;
}
