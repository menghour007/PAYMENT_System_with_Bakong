import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  Menu,
  ShoppingBag,
  Minus,
  Plus,
  X,
  Download,
  Clock3,
  CheckCircle2,
  Phone,
  User,
  MapPinned,
  Landmark,
  ChevronDown,
  MapPin,
  Drone,
  Camera,
  Headphones,
  Watch,
  Gamepad2,
  Package,
  Search,
  Mic,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

type Product = {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  badge?: string;
};

type CartItem = Product & {
  quantity: number;
};

type CheckoutResponse = {
  qrString: string;
  paymentId: string;
  deepLink?: string;
};

const PAYMENT_TIMEOUT_SECONDS = 80;
const MERCHANT_NAME = 'MENGHOUR LIM';

const PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'DJI Air 3',
    price: 0.01,
    image:
      'https://images.unsplash.com/photo-1473968512647-3e447244af8f?auto=format&fit=crop&w=1200&q=80',
    badge: 'NEW',
  },
  {
    id: '2',
    name: 'FPV Racing Drone',
    price: 28,
    image:
      'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=1200&q=80',
    badge: 'HOT',
  },
  {
    id: '3',
    name: 'Drone Camera Kit',
    price: 42,
    image:
      'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80',
    badge: 'SALE',
  },
  {
    id: '4',
    name: 'Battery Pack',
    price: 27,
    originalPrice: 30,
    image:
      'https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=1200&q=80',
    badge: '3D',
  },
];

const categories = [
  { label: 'Drone', icon: Drone },
  { label: 'Camera', icon: Camera },
  { label: 'Virtual Reality', icon: Gamepad2 },
  { label: 'Accessories', icon: Package },
];

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function LocationPicker({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function openBakongDeepLink(url?: string) {
  if (!url) {
    alert('Bakong deeplink unavailable. Please scan QR instead.');
    return;
  }

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile) {
    window.location.assign(url);
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

export default function App() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCheckoutFormOpen, setIsCheckoutFormOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);

  const [checkoutData, setCheckoutData] = useState<CheckoutResponse | null>(null);
  const [qrImage, setQrImage] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'IDLE' | 'PENDING' | 'COMPLETED' | 'EXPIRED'>(
    'IDLE'
  );
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(PAYMENT_TIMEOUT_SECONDS);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [district, setDistrict] = useState('');
  const [addressNote, setAddressNote] = useState('');
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'ABA_KHQR' | 'BAKONG_KHQR'>('ABA_KHQR');

  const [addressText, setAddressText] = useState('');
  const [selectedLat, setSelectedLat] = useState<number | null>(null);
  const [selectedLng, setSelectedLng] = useState<number | null>(null);

  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  const subtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cartItems]
  );

  const shippingFee = useMemo(() => (cartItems.length > 0 ? 0.1 : 0), [cartItems]);
  const grandTotal = useMemo(() => subtotal + shippingFee, [subtotal, shippingFee]);

  function getCartItem(productId: string) {
    return cartItems.find((item) => item.id === productId);
  }

  function addToCart(product: Product) {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  }

  function increaseQty(productId: string) {
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === productId ? { ...item, quantity: item.quantity + 1 } : item
      )
    );
  }

  function decreaseQty(productId: string) {
    setCartItems((prev) =>
      prev
        .map((item) =>
          item.id === productId ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeItem(productId: string) {
    setCartItems((prev) => prev.filter((item) => item.id !== productId));
  }

  function clearCart() {
    setCartItems([]);
  }

  function resetPaymentState() {
    setCheckoutData(null);
    setQrImage('');
    setPaymentStatus('IDLE');
    setCheckoutError('');
    setLoadingCheckout(false);
    setSecondsLeft(PAYMENT_TIMEOUT_SECONDS);
    setShowPaymentSuccess(false);
  }

  function resetAll() {
    resetPaymentState();
    setIsCheckoutFormOpen(false);
    setIsPaymentOpen(false);
  }

  function downloadQrImage() {
    if (!qrImage) return;
    const link = document.createElement('a');
    link.href = qrImage;
    link.download = `bakong-khqr-${checkoutData?.paymentId || 'payment'}.png`;
    link.click();
  }

  async function submitCheckoutForm() {
    if (!customerName.trim()) {
      alert('សូមបញ្ចូលឈ្មោះ');
      return;
    }

    if (!customerPhone.trim()) {
      alert('សូមបញ្ចូលលេខទូរស័ព្ទ');
      return;
    }

    if (!addressText.trim()) {
      alert('សូមជ្រើសរើសអាសយដ្ឋាន');
      return;
    }

    if (cartItems.length === 0) {
      alert('Cart is empty');
      return;
    }

    try {
      setLoadingCheckout(true);
      setCheckoutError('');
      setPaymentStatus('IDLE');
      setQrImage('');

      const orderId = `ORDER-${Date.now()}`;

      const res = await fetch('/api/generate-khqr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(grandTotal.toFixed(2)),
          currency: 'USD',
          description: orderId,
          items: cartItems.map((item) => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to generate KHQR');
      }

      setCheckoutData(data);
      setPaymentStatus('PENDING');
      setSecondsLeft(PAYMENT_TIMEOUT_SECONDS);
      setIsCheckoutFormOpen(false);
      setIsPaymentOpen(true);
    } catch (error: any) {
      setCheckoutError(error?.message || 'Checkout failed');
    } finally {
      setLoadingCheckout(false);
    }
  }

  async function reverseGeocode(lat: number, lng: number) {
    try {
      const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
      const data = await res.json();

      if (data?.address) {
        setAddressText(data.address);
      } else {
        setAddressText(`${lat}, ${lng}`);
      }
    } catch {
      setAddressText(`${lat}, ${lng}`);
    }
  }

  useEffect(() => {
    if (!checkoutData?.qrString) return;

    QRCode.toDataURL(checkoutData.qrString, {
      width: 520,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    }).then(setQrImage);
  }, [checkoutData]);

  useEffect(() => {
    if (!isPaymentOpen || paymentStatus !== 'PENDING') return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPaymentOpen, paymentStatus]);

  useEffect(() => {
    if (!checkoutData?.paymentId || !isPaymentOpen || paymentStatus !== 'PENDING') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/check-status/${checkoutData.paymentId}`);
        const data = await res.json();

        if (data?.status === 'COMPLETED') {
          setPaymentStatus('COMPLETED');

          await fetch('/api/notify-telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentId: checkoutData.paymentId,
              customer: {
                name: customerName,
                phone: customerPhone,
                province: addressText,
                district,
                addressNote,
                telegramEnabled,
                paymentMethod,
                lat: selectedLat,
                lng: selectedLng,
              },
            }),
          });

          setShowPaymentSuccess(true);
          setIsPaymentOpen(false);
          clearCart();
          clearInterval(interval);
          return;
        }

        if (data?.status === 'EXPIRED') {
          setPaymentStatus('EXPIRED');
          clearInterval(interval);
          return;
        }
      } catch (error) {
        console.error('Status check failed:', error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [
    checkoutData,
    isPaymentOpen,
    paymentStatus,
    customerName,
    customerPhone,
    addressText,
    district,
    addressNote,
    telegramEnabled,
    paymentMethod,
    selectedLat,
    selectedLng,
  ]);

  useEffect(() => {
    if (secondsLeft === 0 && paymentStatus === 'PENDING') {
      setPaymentStatus('EXPIRED');
    }
  }, [secondsLeft, paymentStatus]);

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-slate-900">
      <div className="mx-auto w-full max-w-screen-2xl px-3 pb-2 pt-3 sm:px-4 md:px-6 lg:px-8">
        <header className="sticky top-0 z-20 bg-[#f6f7fb]/95 pb-3 backdrop-blur">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:gap-4 lg:px-6">
              <div className="flex items-center justify-between gap-3 lg:min-w-[180px]">
                <div className="text-3xl font-black tracking-tight text-slate-800">
                  CS_Drone<span className="text-blue-600">.</span>
                </div>
                <button className="rounded-xl border border-slate-200 p-2 lg:hidden">
                  <Menu className="h-5 w-5" />
                </button>
              </div>

              

              <div className="hidden lg:ml-auto lg:flex lg:items-center lg:gap-6">
                <div className="text-sm">
                  <div className="text-slate-400">Country/Region</div>
                  <div className="font-semibold text-slate-800">Cambodia (USD $)</div>
                </div>

                <div className="text-sm">
                  <div className="text-slate-400">Welcome</div>
                  <div className="font-semibold text-slate-800">Sign in / Register</div>
                </div>

                <button className="relative flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <ShoppingBag className="h-5 w-5" />
                  Cart
                  {cartCount > 0 && (
                    <span className="absolute -right-3 -top-2 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] text-white">
                      {String(cartCount).padStart(2, '0')}
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div className="border-t border-slate-100">
              <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 overflow-x-auto px-4 py-3 lg:px-6">
                <div className="flex min-w-max items-center gap-5 text-sm text-slate-700">
                  {categories.map(({ label, icon: Icon }) => (
                    <button key={label} className="flex items-center gap-2 whitespace-nowrap font-medium hover:text-blue-600">
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="mx-auto mb-6 max-w-7xl overflow-hidden rounded-[32px] border border-slate-200 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 shadow-sm">
          <div className="grid min-h-[420px] items-center gap-8 px-5 py-10 md:px-8 lg:grid-cols-2 lg:px-10 lg:py-14">
            <div className="relative z-10 max-w-2xl">
              <div className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                Drone Collection
              </div>

              <h1 className="mt-5 text-5xl font-black tracking-tight text-slate-800 sm:text-6xl lg:text-7xl">
                Zypher X1
              </h1>

              <p className="mt-4 max-w-xl text-xl leading-relaxed text-slate-600 sm:text-2xl">
                Leading the way in aerial photography and performance.
              </p>

              <div className="mt-7 flex flex-wrap gap-5 text-sm font-medium text-slate-600 sm:text-base">
                <div className="flex items-center gap-2">
                  <span className="text-blue-600">✦</span>
                  4K UHD Camera
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-600">✦</span>
                  Extended Flight Time
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-blue-600">✦</span>
                  Advanced Navigation
                </div>
              </div>

            </div>

            <div className="relative flex items-center justify-center">
              <div className="absolute bottom-6 h-12 w-3/4 rounded-full bg-slate-400/20 blur-2xl" />
              <img
                src="https://images.unsplash.com/photo-1473968512647-3e447244af8f?auto=format&fit=crop&w=1200&q=80"
                alt="Drone hero"
                className="relative z-10 w-full max-w-xl rounded-[28px] object-cover shadow-[0_30px_60px_rgba(15,23,42,0.16)]"
              />
            </div>
          </div>
        </section>

        <main className="mx-auto w-full max-w-7xl">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-800">Featured Products</h2>
              <p className="text-sm text-slate-500">Top drone gear for creators and pilots</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {PRODUCTS.map((product) => {
              const cartItem = getCartItem(product.id);
              const qty = cartItem?.quantity || 0;

              return (
                <div
                  key={product.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative aspect-[1.05] overflow-hidden bg-slate-100">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />

                    {product.badge && (
                      <div className="absolute right-2 top-2 rounded-full bg-white/95 px-2 py-1 text-[10px] font-semibold text-slate-600 shadow-sm">
                        {product.badge}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 p-3 md:p-4">
                    <div>
                      <div className="text-[16px] font-extrabold leading-none text-slate-800 sm:text-[18px]">
                        ${product.price}
                        {product.originalPrice && (
                          <span className="ml-2 text-[12px] font-bold text-red-500 line-through">
                            ${product.originalPrice}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 line-clamp-2 text-[15px] font-bold leading-5 text-slate-600 sm:text-[16px]">
                        {product.name}
                      </div>
                    </div>

                    {qty > 0 ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => decreaseQty(product.id)}
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-600"
                          >
                            <Minus className="h-4 w-4" />
                          </button>

                          <div className="flex h-10 flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700">
                            {qty}
                          </div>

                          <button
                            onClick={() => increaseQty(product.id)}
                            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-600"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>

                        <button
                          onClick={() => removeItem(product.id)}
                          className="text-sm text-red-500"
                        >
                          លុបចេញ
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(product)}
                        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800"
                      >
                        <ShoppingBag className="h-4 w-4" />
                        បញ្ចូលកន្ត្រក
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        <footer className="mx-auto mt-10 max-w-7xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-6 px-4 py-6 sm:px-5 md:grid-cols-2 lg:grid-cols-3 lg:px-6">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
                  🚁
                </div>
                <div>
                  <div className="font-black text-slate-900">CS Drone Store</div>
                  <div className="text-xs text-slate-500">Fly smarter. Shoot better.</div>
                </div>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                Premium drones, batteries, props, cameras, and accessories with KHQR
                checkout and Telegram order support.
              </p>
            </div>

            <div>
              <div className="text-sm font-black uppercase tracking-wide text-slate-900">
                Contact
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div>Phone: 011 289 264</div>
                <a
                  href="https://t.me/yourtelegramusername"
                  target="_blank"
                  rel="noreferrer"
                  className="block text-right font-bold text-slate-700 hover:text-blue-600"
                >
                  Telegram: @yourtelegramusername
                </a>
                <div>Email: csdronestore@example.com</div>
                <div>Location: Phnom Penh, Cambodia</div>
              </div>
            </div>

            <div>
              <div className="text-sm font-black uppercase tracking-wide text-slate-900">
                Service
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div>• KHQR payment supported</div>
                <div>• Delivery available</div>
                <div>• Product consultation</div>
                <div>• Telegram order confirmation</div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 px-4 py-3 text-center text-xs text-slate-500 sm:px-5 lg:px-6">
            © {new Date().getFullYear()} CS Drone Store. All rights reserved.
          </div>
        </footer>

        {cartCount > 0 && (
          <div className="fixed bottom-4 left-1/2 z-30 w-full max-w-7xl -translate-x-1/2 px-3 sm:px-4 md:px-6 lg:px-8">
            <button
              onClick={() => setIsCheckoutFormOpen(true)}
              className="mx-auto flex w-full items-center justify-between rounded-2xl bg-[#11131a] px-4 py-4 text-white shadow-2xl md:px-5"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold">{cartCount} ទំនិញ</div>
                  <div className="text-xs text-white/70">ចុចដើម្បីគិតលុយ</div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm text-white/70">សរុប</div>
                <div className="text-lg font-bold">${grandTotal.toFixed(2)}</div>
              </div>
            </button>
          </div>
        )}

        {isCheckoutFormOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 p-3 backdrop-blur-sm sm:p-4 lg:p-8">
            <div className="mx-auto h-full w-full max-w-6xl overflow-hidden rounded-[28px] bg-[#efefef] shadow-2xl">
              <div className="flex h-full flex-col lg:grid lg:grid-cols-[0.95fr_1.05fr]">
                <div className="border-b border-slate-200 px-4 py-4 lg:border-b-0 lg:border-r lg:px-6 lg:py-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-2xl font-black text-[#1d1d23]">ទំនិញក្នុងកន្ត្រក</h2>
                    <button
                      onClick={() => setIsCheckoutFormOpen(false)}
                      className="rounded-full p-2 hover:bg-slate-200"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {cartItems.map((item) => (
                      <div key={item.id} className="border-b border-dashed border-slate-300 pb-4">
                        <div className="flex gap-3">
                          <img
                            src={item.image}
                            alt={item.name}
                            className="h-24 w-24 rounded-2xl object-cover"
                          />

                          <div className="flex-1">
                            <div className="font-semibold text-slate-700">{item.name}</div>

                            <div className="mt-3 flex items-center gap-2">
                              <button
                                onClick={() => decreaseQty(item.id)}
                                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <div className="flex h-10 w-16 items-center justify-center rounded-xl border border-slate-300 bg-white font-medium">
                                {item.quantity}
                              </div>
                              <button
                                onClick={() => increaseQty(item.id)}
                                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>

                            <button
                              onClick={() => removeItem(item.id)}
                              className="mt-3 text-sm text-red-500"
                            >
                              លុបចេញ
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="pt-2">
                      <div className="mb-4 flex items-center justify-center gap-2 text-3xl font-black text-[#1d1d23]">
                        <span className="text-green-500">$</span>
                        <span>គិតលុយ</span>
                      </div>

                      <div className="mb-3 text-2xl font-black text-[#1d1d23]">សរុប</div>

                      <div className="rounded-2xl border border-dashed border-slate-300 bg-white">
                        <div className="space-y-3 px-4 py-4">
                          {cartItems.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-start justify-between gap-3 text-slate-600"
                            >
                              <span>
                                {item.name} x {item.quantity}
                              </span>
                              <span>${(item.price * item.quantity).toFixed(1)}</span>
                            </div>
                          ))}

                          <div className="flex items-start justify-between gap-3 text-slate-500">
                            <span>ដឹកជញ្ជូន</span>
                            <span>${shippingFee.toFixed(1)}</span>
                          </div>
                        </div>

                        <div className="border-t border-dashed border-slate-300 px-4 py-4">
                          <div className="flex items-center justify-between font-medium text-slate-700">
                            <span>សរុប:</span>
                            <span>${grandTotal.toFixed(1)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="min-h-0 overflow-y-auto px-4 py-4 lg:px-6 lg:py-6">
                  <section>
                    <h3 className="text-2xl font-black text-[#1d1d23]">ព័ត៌មានអតិថិជន</h3>

                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="mb-1 block text-sm text-slate-600">ឈ្មោះ: *</label>
                        <div className="flex items-center rounded-xl border border-slate-300 bg-white px-3">
                          <User className="h-4 w-4 text-slate-400" />
                          <input
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="Ex: John Doe"
                            className="h-11 w-full bg-transparent px-2 outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm text-slate-600">លេខទូរស័ព្ទ: *</label>
                        <div className="flex items-center rounded-xl border border-slate-300 bg-white px-3">
                          <Phone className="h-4 w-4 text-slate-400" />
                          <input
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            placeholder="Ex: 0xx xxx xxx"
                            className="h-11 w-full bg-transparent px-2 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="mt-8">
                    <h3 className="text-2xl font-black text-[#1d1d23]">ព័ត៌មានដឹកជញ្ជូន</h3>
                    <div className="text-sm text-slate-500">ជូនដោយអ្នកដឹកជញ្ជូន J&T</div>

                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="mb-1 block text-sm text-slate-600">អាសយដ្ឋាន: *</label>
                        <div className="space-y-3">
                          <div className="flex items-center rounded-xl border border-slate-300 bg-white px-3">
                            <MapPinned className="h-4 w-4 text-slate-400" />
                            <input
                              value={addressText}
                              onChange={(e) => setAddressText(e.target.value)}
                              placeholder="ជ្រើសពីផែនទី ឬ វាយដោយដៃ"
                              className="h-11 w-full bg-transparent px-2 outline-none"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => setIsMapOpen(true)}
                            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white"
                          >
                            <MapPin className="h-4 w-4" />
                            ជ្រើសទីតាំងលើផែនទី
                          </button>

                          {selectedLat !== null && selectedLng !== null && (
                            <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                              Lat: {selectedLat.toFixed(6)}, Lng: {selectedLng.toFixed(6)}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm text-slate-600">ខេត្ត: *</label>
                        <div className="flex items-center rounded-xl border border-slate-300 bg-white px-3">
                          <Landmark className="h-4 w-4 text-slate-400" />
                          <select
                            value={district}
                            onChange={(e) => setDistrict(e.target.value)}
                            className="h-11 w-full bg-transparent px-2 outline-none"
                          >
                            <option value="">ជ្រើសរើសខេត្ត/ក្រុង</option>
                            <option value="ភ្នំពេញ">ភ្នំពេញ</option>
                            <option value="កណ្តាល">កណ្តាល</option>
                            <option value="សៀមរាប">សៀមរាប</option>
                            <option value="បាត់ដំបង">បាត់ដំបង</option>
                          </select>
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm text-slate-600">សម្គាល់បន្ថែម:</label>
                        <textarea
                          value={addressNote}
                          onChange={(e) => setAddressNote(e.target.value)}
                          placeholder="..."
                          className="min-h-[92px] w-full rounded-xl border border-slate-300 bg-white px-3 py-3 outline-none"
                        />
                      </div>

                      <label className="flex items-center gap-3 text-sm text-slate-600">
                        <button
                          type="button"
                          onClick={() => setTelegramEnabled((v) => !v)}
                          className={classNames(
                            'relative h-6 w-11 rounded-full transition',
                            telegramEnabled ? 'bg-sky-500' : 'bg-slate-300'
                          )}
                        >
                          <span
                            className={classNames(
                              'absolute top-0.5 h-5 w-5 rounded-full bg-white transition',
                              telegramEnabled ? 'left-[22px]' : 'left-0.5'
                            )}
                          />
                        </button>
                        ទាក់ទងតាម Telegram
                      </label>
                    </div>
                  </section>

                  <section className="mt-8">
                    <h3 className="text-2xl font-black text-[#1d1d23]">បង់ប្រាក់</h3>

                    <div className="mt-4 space-y-3">
                      <button
                        onClick={() => setPaymentMethod('ABA_KHQR')}
                        className={classNames(
                          'flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left',
                          paymentMethod === 'ABA_KHQR'
                            ? 'border-slate-300 bg-slate-100'
                            : 'border-slate-200 bg-white'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="rounded-md bg-red-600 px-2 py-1 text-[10px] font-bold text-white">
                            KHQR
                          </div>
                          <div>
                            <div className="font-bold text-slate-800">ABA KHQR</div>
                            <div className="text-sm text-slate-500">
                              ស្កេនជាមួយកម្មវិធីដែលគាំទ្រ KHQR
                            </div>
                          </div>
                        </div>

                        <div
                          className={classNames(
                            'flex h-5 w-5 items-center justify-center rounded-full border',
                            paymentMethod === 'ABA_KHQR'
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-300'
                          )}
                        >
                          {paymentMethod === 'ABA_KHQR' ? '✓' : ''}
                        </div>
                      </button>

                      <button
                        onClick={() => setPaymentMethod('BAKONG_KHQR')}
                        className={classNames(
                          'flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left',
                          paymentMethod === 'BAKONG_KHQR'
                            ? 'border-slate-300 bg-slate-100'
                            : 'border-slate-200 bg-white'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow">
                            🟡
                          </div>
                          <div>
                            <div className="font-bold text-slate-800">Bakong</div>
                            <div className="text-sm text-slate-500">បង់តាម Bakong app</div>
                          </div>
                        </div>

                        <div
                          className={classNames(
                            'flex h-5 w-5 items-center justify-center rounded-full border',
                            paymentMethod === 'BAKONG_KHQR'
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-300'
                          )}
                        >
                          {paymentMethod === 'BAKONG_KHQR' ? '✓' : ''}
                        </div>
                      </button>
                    </div>

                    {checkoutError && (
                      <div className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
                        {checkoutError}
                      </div>
                    )}

                    <button
                      onClick={submitCheckoutForm}
                      disabled={loadingCheckout}
                      className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#11131a] font-semibold text-white disabled:opacity-50"
                    >
                      <span className="text-green-400">$</span>
                      {loadingCheckout ? 'កំពុងបង្កើត KHQR...' : 'គិតលុយ'}
                    </button>
                  </section>
                </div>
              </div>
            </div>
          </div>
        )}

        {isMapOpen && (
          <div className="fixed inset-0 z-[70] bg-black/50 p-4 backdrop-blur-sm">
            <div className="mx-auto flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <h3 className="text-lg font-bold text-slate-900">ជ្រើសទីតាំងលើផែនទី</h3>
                <button
                  onClick={() => setIsMapOpen(false)}
                  className="rounded-full p-2 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1">
                <MapContainer
                  center={[11.5564, 104.9282]}
                  zoom={13}
                  className="h-full w-full"
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  <LocationPicker
                    onPick={async (lat, lng) => {
                      setSelectedLat(lat);
                      setSelectedLng(lng);
                      await reverseGeocode(lat, lng);
                    }}
                  />

                  {selectedLat !== null && selectedLng !== null && (
                    <Marker position={[selectedLat, selectedLng]} />
                  )}
                </MapContainer>
              </div>

              <div className="border-t border-slate-200 px-4 py-3">
                <button
                  onClick={() => setIsMapOpen(false)}
                  className="h-11 w-full rounded-xl bg-slate-900 text-sm font-semibold text-white"
                >
                  រក្សាទុកទីតាំង
                </button>
              </div>
            </div>
          </div>
        )}

        {isPaymentOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 p-3 backdrop-blur-sm sm:p-4 lg:p-8">
            <div className="mx-auto grid min-h-[560px] w-full max-w-6xl overflow-hidden rounded-[28px] bg-[#fafafa] shadow-2xl lg:grid-cols-[1.02fr_0.98fr]">
              <div className="border-b border-slate-200 bg-[#f6f6f6] p-4 sm:p-5 lg:border-b-0 lg:border-r">
                <div className="mb-4 flex items-center justify-between lg:hidden">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">KHQR Payment</h2>
                    <p className="text-xs text-slate-500">សូមស្កេនដើម្បីបង់ប្រាក់</p>
                  </div>
                  <button
                    onClick={() => {
                      setIsPaymentOpen(false);
                      resetPaymentState();
                    }}
                    className="rounded-full p-2 hover:bg-slate-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mx-auto max-w-[350px]">
                  <div className="relative overflow-hidden rounded-[30px] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.10)]">
                    <div className="relative bg-[#ee171a] px-2 py-2 text-center text-white">
                      <div className="text-[20px] font-bold tracking-[0.18em]">KHQR</div>
                      <div className="absolute bottom-0 right-0 h-0 w-0 border-b-[40px] border-l-[40px] border-b-transparent border-l-white" />
                    </div>

                    <div className="px-2 pb-2 pt-2 sm:px-8 sm:pb-8 sm:pt-7">
                      <div className="text-[17px] font-semibold uppercase tracking-wide text-black sm:text-[18px]">
                        {MERCHANT_NAME}
                      </div>

                      <div className="mt-3 text-2xl font-black leading-none text-black sm:text-xl lg:text-xl">
                        ${grandTotal.toFixed(2)}
                      </div>

                      <div className="my-5 border-t-2 border-dashed border-slate-300 sm:my-2" />

                      <div className="bg-white">
                        {qrImage ? (
                          <img
                            src={qrImage}
                            alt="KHQR"
                            className="mx-auto aspect-square w-full max-w-[300px] object-contain"
                          />
                        ) : (
                          <div className="flex h-[260px] items-center justify-center text-slate-500 sm:h-[320px]">
                            Loading QR...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 rounded-2xl bg-white px-2 py-2 text-center text-sm text-slate-600 shadow-sm">
                    Please scan this KHQR with Bakong or any supported banking app
                  </div>

                  <div className="mt-2 flex items-center justify-between rounded-2xl bg-white px-2 py-2 shadow-sm">
                    <div className="text-sm text-slate-500">ពេលនៅសល់</div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                      <Clock3 className="h-4 w-4 text-amber-500" />
                      {secondsLeft}s
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                      onClick={() => openBakongDeepLink(checkoutData?.deepLink)}
                      disabled={!checkoutData?.deepLink}
                      className="flex h-12 w-full items-center justify-center rounded-2xl bg-blue-600 font-semibold text-white disabled:opacity-50"
                    >
                      Open Bakong App
                    </button>
                    {!checkoutData?.deepLink && (
                        <p className="text-xs text-red-500 text-center mt-2">
                          Cannot open Bakong app. Please scan QR instead.
                        </p>
                      )}
                    <button
                      onClick={downloadQrImage}
                      disabled={!qrImage}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#111827] font-semibold text-white disabled:opacity-50"
                    >
                      <Download className="h-5 w-5" />
                      Download QR
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-col bg-white">
                <div className="hidden items-center justify-between border-b border-slate-200 px-6 py-5 lg:flex">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">KHQR Details</h2>
                    <p className="text-sm text-slate-500">ព័ត៌មានអតិថិជន និងទំនិញ</p>
                  </div>
                  <button
                    onClick={() => {
                      setIsPaymentOpen(false);
                      resetPaymentState();
                    }}
                    className="rounded-full p-2 hover:bg-slate-100"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5 lg:px-6 lg:py-5">
                  <div className="space-y-3">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      <div><strong>ឈ្មោះ:</strong> {customerName || '-'}</div>
                      <div><strong>លេខទូរស័ព្ទ:</strong> {customerPhone || '-'}</div>
                      <div><strong>អាសយដ្ឋាន:</strong> {addressText || '-'}</div>
                      <div><strong>ខេត្ត:</strong> {district || '-'}</div>
                      <div><strong>សម្គាល់:</strong> {addressNote || '-'}</div>
                      <div><strong>Telegram:</strong> {telegramEnabled ? 'Yes' : 'No'}</div>
                      <div><strong>Payment:</strong> {paymentMethod}</div>
                    </div>

                    {cartItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"
                      >
                        <div className="min-w-0 pr-3">
                          <div className="truncate font-semibold text-slate-800">{item.name}</div>
                          <div className="text-sm text-slate-500">
                            {item.quantity} × ${item.price.toFixed(2)}
                          </div>
                        </div>
                        <div className="font-bold text-slate-800">
                          ${(item.quantity * item.price).toFixed(2)}
                        </div>
                      </div>
                    ))}

                    <div className="rounded-2xl bg-slate-100 px-4 py-4">
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Subtotal</span>
                        <span>${subtotal.toFixed(2)}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-slate-600">
                        <span>Shipping</span>
                        <span>${shippingFee.toFixed(2)}</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-slate-300 pt-3 font-bold text-slate-900">
                        <span>Total</span>
                        <span>${grandTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showPaymentSuccess && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-[28px] bg-white p-6 text-center shadow-2xl">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>

              <h2 className="mt-5 text-2xl font-bold text-slate-900">Payment Completed</h2>
              <p className="mt-2 text-sm text-slate-500">Your payment was successful.</p>

              {checkoutData?.paymentId && (
                <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Payment ID: <span className="font-medium">{checkoutData.paymentId}</span>
                </div>
              )}

              <button
                onClick={() => {
                  setShowPaymentSuccess(false);
                  resetAll();
                }}
                className="mt-6 h-12 w-full rounded-2xl bg-slate-900 font-semibold text-white"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}