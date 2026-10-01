import { useEffect, useMemo, useState } from "react";
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

function Header({ userName, onLogin }: { userName?: string | null; onLogin: () => void }) {
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
          <button className="icon-button inverse" aria-label="Notifications"><Bell size={19} /></button>
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

function LivreurCard({ livreur, onOrder }: { livreur: Livreur; onOrder: (livreur: Livreur) => void }) {
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
        <div className="distance-pill"><Navigation size={13} /> {livreur.distance.toFixed(1)} km</div>
      </div>
      <div className="livreur-meta-row">
        <span className="rating"><Star size={14} fill="currentColor" /> {livreur.rating.toFixed(1)} <small>({livreur.deliveries})</small></span>
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
          <button className="primary-small" onClick={() => onOrder(livreur)}>Commander <ArrowRight size={15} /></button>
        </div>
      </div>
    </article>
  );
}

function OrderModal({ livreur, onClose, onConfirm }: { livreur: Livreur; onClose: () => void; onConfirm: (quantity: number, address: string) => void }) {
  const [quantity, setQuantity] = useState(1);
  const [address, setAddress] = useState("Akanda, La Sablière");
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
        <button className="primary-button full" onClick={() => onConfirm(quantity, address)}><Check size={17} /> Confirmer la demande</button>
        <p className="modal-note">Paiement à la livraison · La commande sera confirmée par le livreur.</p>
      </section>
    </div>
  );
}

function ClientHome({ livreurs, onOrder, onLocate }: { livreurs: Livreur[]; onOrder: (livreur: Livreur) => void; onLocate: () => void }) {
  return (
    <>
      <section className="welcome-row">
        <div><span className="eyebrow">Bonjour, bienvenue</span><h1>De l’eau, <em>sans détour.</em></h1></div>
        <button className="icon-button menu-button" aria-label="Ouvrir le menu"><Menu size={20} /></button>
      </section>
      <button className="location-bar" onClick={onLocate}><span className="location-icon"><MapPin size={17} /></span><span><small>Livrer à</small><strong>Akanda, Libreville</strong></span><ChevronRight size={18} /></button>
      <section className="hero-card">
        <div className="hero-copy"><span className="hero-kicker"><span className="pulse-dot" /> 6 livreurs actifs autour de vous</span><h2>Votre réserve ne devrait jamais être vide.</h2><p>Trouvez de l’eau potable et faites-vous livrer simplement, près de chez vous.</p><button className="light-button" onClick={onLocate}>Voir les livreurs <ArrowRight size={16} /></button></div>
        <div className="hero-art" aria-hidden="true"><Droplets size={92} strokeWidth={1.2} /><div className="hero-ripple ripple-one" /><div className="hero-ripple ripple-two" /></div>
      </section>
      <section className="quick-stats"><div><strong>15–25</strong><span>min moyen</span></div><div><strong>4.8/5</strong><span>note service</span></div><div><strong>7j/7</strong><span>disponible</span></div></section>
      <section className="section-block"><div className="section-heading"><div><span className="eyebrow">À proximité</span><h2>Livreurs disponibles</h2></div><button className="text-button" onClick={onLocate}><Search size={15} /> Rechercher</button></div><div className="list-stack">{livreurs.map(livreur => <LivreurCard key={livreur.id} livreur={livreur} onOrder={onOrder} />)}</div></section>
      <section className="trust-strip"><ShieldCheck size={21} /><div><strong>Des livreurs vérifiés</strong><span>Chaque profil est contrôlé avant d’être visible.</span></div><ChevronRight size={17} /></section>
    </>
  );
}

function OrdersView({ orders, onAdvance, onCancel }: { orders: Order[]; onAdvance: (id: string) => void; onCancel: (id: string) => void }) {
  return (
    <section className="page-section"><div className="page-heading"><div><span className="eyebrow">Votre activité</span><h1>Mes commandes</h1></div><button className="icon-button"><Bell size={18} /></button></div>{orders.length === 0 ? <div className="empty-state"><div className="empty-icon"><ShoppingBag size={25} /></div><h2>Aucune commande pour le moment</h2><p>Votre prochaine livraison d’eau apparaîtra ici.</p></div> : <div className="list-stack">{orders.map(order => <article className="order-card" key={order.id}><div className="order-card-top"><div><span className="eyebrow">Commande #{order.id.slice(-4)}</span><h2>{order.livreur.name}</h2></div><span className={`status-pill ${statusStyles[order.status]}`}>{order.status}</span></div><div className="order-route"><MapPin size={15} /><span>{order.address}</span><ChevronRight size={16} /></div><div className="order-details"><span>{order.quantity} × {order.livreur.product}</span><strong>{formatPrice(order.total)}</strong></div><div className="order-timeline"><span className={order.status !== "Annulée" ? "timeline-dot done" : "timeline-dot"} /><span className="timeline-line" /><span className={order.status === "Acceptée" || order.status === "En route" || order.status === "Livrée" ? "timeline-dot done" : "timeline-dot"} /><span className="timeline-line" /><span className={order.status === "En route" || order.status === "Livrée" ? "timeline-dot done" : "timeline-dot"} /><span className="timeline-line" /><span className={order.status === "Livrée" ? "timeline-dot done" : "timeline-dot"} /></div><div className="timeline-labels"><span>Demande</span><span>Acceptée</span><span>En route</span><span>Livrée</span></div>{order.status === "Livrée" ? <div className="rating-row"><span>Votre avis</span><span className="stars"><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} fill="currentColor" /><Star size={16} /></span></div> : order.status !== "Annulée" ? <div className="order-actions"><button className="secondary-small" onClick={() => onAdvance(order.id)}>{order.status === "Demandée" ? "Simuler l’acceptation" : order.status === "Acceptée" ? "Simuler le départ" : "Simuler la livraison"}</button><button className="ghost-small" onClick={() => onCancel(order.id)}>Annuler</button></div> : null}</article>)}</div>}</section>
  );
}

function DriverView({ onLogin }: { onLogin: () => void }) {
  const [available, setAvailable] = useState(false);
  return <section className="page-section"><div className="page-heading"><div><span className="eyebrow">Espace partenaire</span><h1>Je suis livreur</h1></div><button className="icon-button"><Menu size={18} /></button></div><div className="driver-hero"><div className="driver-hero-icon"><Truck size={27} /></div><div><span className="eyebrow">Gagnez du temps, livrez mieux</span><h2>Recevez les demandes autour de vous.</h2><p>Votre disponibilité, votre zone et vos tarifs restent sous votre contrôle.</p></div></div><article className="availability-card"><div><span className="eyebrow">Statut en direct</span><h2>{available ? "Vous êtes visible" : "Vous êtes hors ligne"}</h2><p>{available ? "Les clients proches peuvent vous trouver maintenant." : "Activez votre disponibilité pour apparaître dans la recherche."}</p></div><button className={available ? "availability-toggle on" : "availability-toggle"} onClick={() => setAvailable(value => !value)} aria-pressed={available}><span /></button></article><section className="driver-stats"><div><span>Demandes aujourd’hui</span><strong>3</strong><small>+2 hier</small></div><div><span>Livraisons du mois</span><strong>28</strong><small>Objectif 40</small></div><div><span>Votre note</span><strong>4.9</strong><small>sur 5</small></div></section><article className="driver-onboarding"><div className="onboarding-icon"><Plus size={20} /></div><div><h2>Créer mon profil livreur</h2><p>Ajoutez votre zone, vos contenants et vos tarifs pour commencer.</p></div><button className="round-action" onClick={onLogin}><ArrowRight size={17} /></button></article><p className="fine-print">La validation de votre profil est effectuée par Eau Rapide avant sa mise en ligne.</p></section>;
}

function ProfileView({ userName, onLogin }: { userName?: string | null; onLogin: () => void }) {
  return <section className="page-section"><div className="page-heading"><div><span className="eyebrow">Compte</span><h1>Mon espace</h1></div><button className="icon-button"><Menu size={18} /></button></div><article className="profile-card"><div className="profile-avatar">{userName ? userName.slice(0, 1).toUpperCase() : <UserRound size={24} />}</div><div><h2>{userName || "Visiteur"}</h2><p>{userName ? "Compte Eau Rapide actif" : "Connectez-vous pour synchroniser vos commandes"}</p></div>{!userName && <button className="primary-small" onClick={onLogin}>Se connecter</button>}</article><div className="settings-list"><button><div className="setting-icon"><MapPin size={17} /></div><div><strong>Mes adresses</strong><span>Gérer vos lieux de livraison</span></div><ChevronRight size={17} /></button><button><div className="setting-icon"><Heart size={17} /></div><div><strong>Mes livreurs favoris</strong><span>Retrouvez vos contacts préférés</span></div><ChevronRight size={17} /></button><button><div className="setting-icon"><ShieldCheck size={17} /></div><div><strong>Confidentialité</strong><span>Vos données et votre position</span></div><ChevronRight size={17} /></button></div><div className="account-note"><CheckCircle2 size={17} /><span>Version pilote · Paiement à la livraison</span></div></section>;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("accueil");
  const [mode, setMode] = useState<Mode>("client");
  const [selectedLivreur, setSelectedLivreur] = useState<Livreur | null>(null);
  const [orders, setOrders] = useState<Order[]>(() => {
    try { return JSON.parse(localStorage.getItem("eau-rapide-orders") || "[]") as Order[]; } catch { return []; }
  });
  const { data: user } = trpc.auth.me.useQuery();
  const livreursQuery = trpc.marketplace.livreurs.useQuery();
  const livreurs = useMemo(() => livreursQuery.data?.length ? livreursQuery.data : fallbackLivreurs, [livreursQuery.data]);

  useEffect(() => {
    localStorage.setItem("eau-rapide-orders", JSON.stringify(orders));
  }, [orders]);

  const login = () => {
    try { startLogin(); } catch { toast.error("La connexion n’est pas encore configurée dans cet aperçu."); }
  };

  const locate = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Géolocalisation indisponible", { description: "Choisissez votre quartier pour voir les livreurs." });
      return;
    }
    toast("Recherche de votre position…", { description: "Autorisez la localisation pour affiner les livreurs proches." });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => toast.success("Position trouvée", { description: `Précision d’environ ${Math.round(coords.accuracy)} m. Nous affichons les livreurs proches.` }),
      () => toast.error("Position non disponible", { description: "Vous pouvez continuer en recherchant par quartier." }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  };
  const confirmOrder = (livreur: Livreur, quantity: number, address: string) => {
    const order: Order = { id: `ER-${Date.now()}`, livreur, quantity, address, total: livreur.unitPrice * quantity + 1000, status: "Demandée", createdAt: new Date().toISOString() };
    setOrders(current => [order, ...current]);
    setSelectedLivreur(null);
    setActiveTab("commandes");
    toast.success("Demande envoyée", { description: `${livreur.name} va confirmer votre livraison.` });
  };
  const advanceOrder = (id: string) => setOrders(current => current.map(order => order.id !== id ? order : { ...order, status: order.status === "Demandée" ? "Acceptée" : order.status === "Acceptée" ? "En route" : "Livrée" }));
  const cancelOrder = (id: string) => { setOrders(current => current.map(order => order.id === id ? { ...order, status: "Annulée" } : order)); toast("Commande annulée"); };

  return <div className="app-shell"><Header userName={user?.name} onLogin={login} /><main className="app-main"><div className="mode-switch" role="tablist" aria-label="Type d’espace"><button className={mode === "client" ? "mode-button active" : "mode-button"} onClick={() => { setMode("client"); setActiveTab("accueil"); }}><ShoppingBag size={15} /> Je cherche de l’eau</button><button className={mode === "livreur" ? "mode-button active" : "mode-button"} onClick={() => { setMode("livreur"); setActiveTab("profil"); }}><Truck size={15} /> Je suis livreur</button></div>{mode === "livreur" ? <DriverView onLogin={login} /> : activeTab === "accueil" ? <ClientHome livreurs={livreurs} onOrder={setSelectedLivreur} onLocate={locate} /> : activeTab === "commandes" ? <OrdersView orders={orders} onAdvance={advanceOrder} onCancel={cancelOrder} /> : <ProfileView userName={user?.name} onLogin={login} />}</main><BottomNav activeTab={activeTab} onChange={setActiveTab} />{selectedLivreur && <OrderModal livreur={selectedLivreur} onClose={() => setSelectedLivreur(null)} onConfirm={(quantity, address) => confirmOrder(selectedLivreur, quantity, address)} />}</div>;
}
