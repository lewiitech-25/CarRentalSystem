import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Login from './Login';
import PaystackPay from './PaystackPay';
import landingCarImage from './assets/landing-car.jpg';
import carHireImage from './assets/car-hire.jpg';
import { auth, db } from './firebase';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 0
});

const INITIAL_CAR_FORM = {
  make: '',
  model: '',
  year: '',
  category: '',
  pricePerDay: '',
  licensePlate: ''
};

const INITIAL_CUSTOMER_FORM = {
  name: '',
  email: '',
  phone: '',
  licenseNumber: ''
};

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', roles: ['admin', 'user'] },
  { id: 'fleet', label: 'Fleet', roles: ['admin', 'user'] },
  { id: 'customers', label: 'Customers', roles: ['admin'] },
  { id: 'bookings', label: 'Bookings', roles: ['admin', 'user'] },
  { id: 'admin', label: 'Admin', roles: ['admin'] }
];

function MarketingHome({ onLogin, onSignup }) {
  return (
    <main className="marketing-page">
      <header className="marketing-nav">
        <p className="marketing-logo">DriveDesk</p>
        <button type="button" className="marketing-cta" onClick={onSignup}>
          Sign up
        </button>
      </header>
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">Modern Rental Operations</p>
          <h1>Run your car rental business in one clean workspace.</h1>
          <p>DriveDesk handles bookings, fleet tracking, customer records, and admin actions with a dashboard built for speed.</p>
          <div className="hero-actions">
            <button type="button" className="marketing-cta" onClick={onLogin}>Login</button>
            <button type="button" className="marketing-cta ghost-cta" onClick={onSignup}>Sign up</button>
            <span className="hero-note">Set up in minutes and start taking bookings.</span>
          </div>
          <img className="hero-inline-image" src={carHireImage} alt="Customer picking up a rental car" />
        </div>
        <div className="hero-card-grid">
          <article className="hero-image-card">
            <img src={landingCarImage} alt="Happy customer picking up a rental car" />
          </article>
          <section className="operations-panel">
            <div className="operations-header">
              <p className="eyebrow">Operations Snapshot</p>
              <h3>Rental activity without the spreadsheet chaos.</h3>
            </div>

            <div className="operations-grid">
              <article>
                <span>Bookings</span>
                <strong>Live confirmations</strong>
                <p>Create, pay, and track rentals from one workflow.</p>
              </article>
              <article>
                <span>Fleet</span>
                <strong>Status-aware inventory</strong>
                <p>Know what is available, active, returned, or overdue at a glance.</p>
              </article>
            </div>

            <div className="operations-points">
              <article>
                <strong>Customers book for themselves</strong>
                <p>Sign up, choose a car, pay, and see booking status without admin back-and-forth.</p>
              </article>
            </div>
          </section>
        </div>
      </section>

      <section className="why-section">
        <div className="why-card">
          <div className="why-copy">
            <p className="eyebrow">Why Choose Us</p>
            <h2>Built for rental teams that need fewer steps and clearer visibility.</h2>
            <p>
              DriveDesk keeps the customer journey simple while still giving operators the controls they need behind
              the scenes. Instead of burying work under disconnected forms, it keeps the rental lifecycle readable.
            </p>
          </div>

          <div className="why-list">
            <article>
              <strong>Faster booking flow</strong>
              <p>Users sign up, get linked to their own profile, and start hiring cars without waiting for admin setup.</p>
            </article>
            <article>
              <strong>Role-based control</strong>
              <p>Admins manage fleet, payments, and customer records, while users only see the actions relevant to them.</p>
            </article>
            <article>
              <strong>Integrated payments</strong>
              <p>Paystack checkout keeps payment status visible inside the same booking history users already understand.</p>
            </article>
            <article>
              <strong>Operational clarity</strong>
              <p>Availability, active rentals, overdue returns, and booking records stay inside one connected loop.</p>
            </article>
          </div>
        </div>
      </section>
<<<<<<< HEAD
      <section className="marketing-strip">
        <article><strong>Dashboard</strong><span>Real-time cards and operational metrics.</span></article>
        <article><strong>Fleet</strong><span>Status-aware inventory with searchable records.</span></article>
        <article><strong>Admin</strong><span>Quick forms for adding cars and customers.</span></article>
=======

      <section className="process-section">
        <div className="process-intro">
          <p className="eyebrow">How It Works</p>
          <h2>From signup to return, every stage stays obvious.</h2>
        </div>

        <div className="process-flow">
          <article className="process-row">
            <div className="process-text">
              <span className="process-index">01</span>
              <h3>Self-serve onboarding</h3>
              <p>
                A user creates an account, gets connected to a matching customer record, and enters the system ready
                to book without admin hand-holding.
              </p>
              <div className="process-tags">
                <span>Account linked</span>
                <span>Customer ready</span>
                <span>Role-aware access</span>
              </div>
            </div>
            <div className="process-visual">
              <div className="visual-shell">
                <strong>Account Ready</strong>
                <p>Name, email, and booking identity stay connected to the same login.</p>
              </div>
            </div>
          </article>

          <article className="process-row reverse">
            <div className="process-text">
              <span className="process-index">02</span>
              <h3>Choose, pay, confirm</h3>
              <p>
                Users pick an available car, set rental days clearly, and move through Paystack checkout without
                leaving the booking context behind.
              </p>
              <div className="process-tags">
                <span>Availability first</span>
                <span>Secure payment</span>
                <span>Visible status</span>
              </div>
            </div>
            <div className="process-visual meter-visual">
              <div className="meter-card">
                <label>Vehicle matched</label>
                <div><span style={{ width: '84%' }} /></div>
              </div>
              <div className="meter-card">
                <label>Payment verified</label>
                <div><span style={{ width: '91%' }} /></div>
              </div>
              <div className="meter-card">
                <label>Booking confirmed</label>
                <div><span style={{ width: '87%' }} /></div>
              </div>
            </div>
          </article>

          <article className="process-row">
            <div className="process-text">
              <span className="process-index">03</span>
              <h3>Track the rental lifecycle</h3>
              <p>
                Teams can monitor active bookings, spot what is due back, and mark returns with less ambiguity and
                fewer missed handoffs.
              </p>
              <div className="process-tags">
                <span>Due-back visibility</span>
                <span>Return actions</span>
                <span>Shared records</span>
              </div>
            </div>
            <div className="process-visual timeline-visual">
              <div className="timeline-node active">Booked</div>
              <div className="timeline-line" />
              <div className="timeline-node active">Paid</div>
              <div className="timeline-line" />
              <div className="timeline-node">Returned</div>
            </div>
          </article>
        </div>
>>>>>>> cf23647 (Improve landing page, auth flow, and Paystack booking payments)
      </section>
    </main>
  );
}

export default function App() {
  const [authView, setAuthView] = useState('home');
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [role, setRole] = useState(null);
  const [activeView, setActiveView] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');

  const [cars, setCars] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [bookings, setBookings] = useState([]);

  const [carForm, setCarForm] = useState(INITIAL_CAR_FORM);
  const [customerForm, setCustomerForm] = useState(INITIAL_CUSTOMER_FORM);
  const [bookingForm, setBookingForm] = useState({ customerId: '', carId: '', days: 1 });
  const [userCustomerId, setUserCustomerId] = useState('');
  const [provisioningProfile, setProvisioningProfile] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setAuthUser(currentUser);
      setError('');
      setMessage('');
      setActiveView('dashboard');

      if (!currentUser) {
        setRole(null);
        setCars([]);
        setCustomers([]);
        setBookings([]);
        setUserCustomerId('');
        setLoading(false);
        setAuthReady(true);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const resolvedRole = userDoc.data()?.role;
        if (resolvedRole !== 'admin' && resolvedRole !== 'user') {
          throw new Error('Your account has no valid role. Set role in Firestore users/{uid}.');
        }
        setRole(resolvedRole);
      } catch (err) {
        setRole(null);
        setError(err.message || 'Could not determine user role.');
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (role) {
      loadAll();
    }
  }, [role]);

  useEffect(() => {
    if (!authReady || !authUser) {
      return;
    }

    const url = new URL(window.location.href);
    const reference = url.searchParams.get('reference') || url.searchParams.get('trxref');
    const isPaystackCallback = url.searchParams.get('paystack') === 'callback';
    if (!isPaystackCallback || !reference) {
      return;
    }

    let ignore = false;

    async function verifyPayment() {
      try {
        setBusy(true);
        setError('');
        setMessage('Verifying Paystack payment...');

        const result = await fetchJson(`/api/payments/verify?reference=${encodeURIComponent(reference)}`);
        if (ignore) {
          return;
        }

        setMessage(result.alreadyPaid ? 'Payment already verified.' : 'Paystack payment verified.');
        await loadAll();
      } catch (err) {
        if (ignore) {
          return;
        }
        setError(err.message || 'Could not verify Paystack payment.');
      } finally {
        if (ignore) {
          return;
        }
        setBusy(false);
        url.searchParams.delete('paystack');
        url.searchParams.delete('reference');
        url.searchParams.delete('trxref');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      }
    }

    verifyPayment();

    return () => {
      ignore = true;
    };
  }, [authReady, authUser]);

  const navItems = useMemo(() => NAV_ITEMS.filter((item) => item.roles.includes(role)), [role]);

  useEffect(() => {
    if (navItems.length > 0 && !navItems.some((item) => item.id === activeView)) {
      setActiveView(navItems[0].id);
    }
  }, [navItems, activeView]);

  const roleCustomers = useMemo(() => {
    if (role !== 'user') return customers;
    const email = authUser?.email?.toLowerCase();
    if (!email) return [];
    return customers.filter((customer) => customer.email?.toLowerCase() === email);
  }, [role, authUser, customers]);

  const linkedCustomer = useMemo(() => {
    if (role !== 'user' || !userCustomerId) {
      return null;
    }
    return roleCustomers.find((customer) => customer.customerId === userCustomerId) || null;
  }, [role, roleCustomers, userCustomerId]);

  useEffect(() => {
    if (role !== 'user' || !authUser?.email || loading || provisioningProfile) {
      return;
    }
    if (roleCustomers.length > 0) {
      return;
    }

    let ignore = false;

    async function provisionCustomerProfile() {
      try {
        setProvisioningProfile(true);
        setBusy(true);
        setError('');
        setMessage('Setting up your customer profile...');

        const fallbackName = authUser.displayName || authUser.email.split('@')[0] || 'Customer';
        await fetchJson('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: fallbackName,
            email: authUser.email,
            phone: 'Pending Update',
            licenseNumber: 'Pending Update'
          })
        });

        if (ignore) {
          return;
        }

        setMessage('Your customer profile is ready. You can now book a car.');
        await loadAll();
      } catch (err) {
        if (ignore) {
          return;
        }
        setError(err.message || 'Could not set up your customer profile.');
      } finally {
        if (ignore) {
          return;
        }
        setProvisioningProfile(false);
        setBusy(false);
      }
    }

    provisionCustomerProfile();

    return () => {
      ignore = true;
    };
  }, [authUser, loading, provisioningProfile, role, roleCustomers]);

  useEffect(() => {
    if (role !== 'user') return;
    if (roleCustomers.length === 0) { setUserCustomerId(''); return; }
    if (!userCustomerId || !roleCustomers.some((customer) => customer.customerId === userCustomerId)) {
      const firstCustomerId = roleCustomers[0].customerId;
      setUserCustomerId(firstCustomerId);
      setBookingForm((prev) => ({ ...prev, customerId: firstCustomerId }));
    }
  }, [role, roleCustomers, userCustomerId]);

  const availableCars = useMemo(() => cars.filter((car) => car.status === 'Available'), [cars]);

  const dashboard = useMemo(() => {
    const totalCars = cars.length;
    const totalCustomers = customers.length;
    const activeBookingsToday = bookings.filter((b) => b.status === 'Confirmed').length;
    const availableCarsToday = availableCars.length;
    const totalRevenue = bookings
      .filter((b) => b.status === 'Confirmed' && b.paymentStatus === 'Paid')
      .reduce((sum, b) => sum + Number(b.totalAmount || 0), 0);
    return { totalCars, totalCustomers, activeBookingsToday, availableCarsToday, totalRevenue };
  }, [cars, customers, bookings, availableCars]);

  const filteredCars = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return cars;
    return cars.filter((c) => `${c.carId} ${c.make} ${c.model} ${c.category}`.toLowerCase().includes(needle));
  }, [cars, search]);

  const filteredCustomers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter((c) => `${c.customerId} ${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(needle));
  }, [customers, search]);

  const filteredBookings = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return bookings;
    return bookings.filter((b) => `${b.bookingId} ${b.customerId} ${b.carId} ${b.status}`.toLowerCase().includes(needle));
  }, [bookings, search]);

  const visibleBookings = useMemo(() => {
    if (role !== 'user') return filteredBookings;
    if (!userCustomerId) return [];
    return filteredBookings.filter((booking) => booking.customerId === userCustomerId);
  }, [role, filteredBookings, userCustomerId]);

  const userBookings = useMemo(() => {
    if (!userCustomerId) return [];
    return bookings.filter((booking) => booking.customerId === userCustomerId);
  }, [bookings, userCustomerId]);

  const userStats = useMemo(() => {
    const myTotalBookings = userBookings.length;
    const myActiveBookings = userBookings.filter((booking) => booking.status === 'Confirmed').length;
    const myUnpaidAmount = userBookings
      .filter((booking) => booking.status === 'Confirmed' && booking.paymentStatus !== 'Paid')
      .reduce((sum, booking) => sum + Number(booking.totalAmount || 0), 0);
    const myPaidBookings = userBookings.filter((booking) => booking.paymentStatus === 'Paid').length;
    return { myTotalBookings, myActiveBookings, myUnpaidAmount, myPaidBookings };
  }, [userBookings]);

  async function fetchJson(url, options) {
    const res = await fetch(url, options);
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      const msg = data?.error || `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return data;
  }

  async function loadAll() {
    try {
      setLoading(true);
      setError('');
      const [carsData, customersData, bookingsData] = await Promise.all([
        fetchJson('/api/cars'),
        fetchJson('/api/customers'),
        fetchJson('/api/bookings')
      ]);
      setCars((carsData?.cars || carsData || []).map(c => ({
        ...c,
        carId: c.id || c.carId,
        pricePerDay: parseFloat(c.price_per_day || c.pricePerDay || 0),
        status: (c.status === 'available' || c.status === 'Available') ? 'Available' : c.status
      })));
      setCustomers((customersData || []).map(c => ({
        ...c,
        customerId: c.customerId || c.id
      })));
      setBookings((bookingsData?.bookings || bookingsData || []).map(b => ({
        ...b,
        bookingId: b.id || b.bookingId,
        customerId: b.customer_id || b.customerId,
        carId: b.car_id || b.carId,
        totalAmount: parseFloat(b.total_amount || b.totalAmount || 0),
        status: b.status === 'confirmed' ? 'Confirmed' : b.status === 'cancelled' ? 'Cancelled' : b.status === 'pending' ? 'Pending' : b.status,
        paymentStatus: b.payment_status || b.paymentStatus || 'Unpaid',
        startDate: b.start_date || b.startDate,
        endDate: b.end_date || b.endDate
      })));
    } catch (err) {
      setError(err.message || 'Could not load data right now.');
    } finally {
      setLoading(false);
    }
  }

  async function addCar(e) {
    e.preventDefault();
    if (!carForm.make || !carForm.model || !carForm.year || !carForm.category || !carForm.pricePerDay) {
      setError('Fill all required car fields.');
      return;
    }
    try {
      setBusy(true);
      setError('');
      setMessage('');
      await fetchJson('/api/cars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          make: carForm.make,
          model: carForm.model,
          year: Number(carForm.year),
          category: carForm.category,
          price_per_day: Number(carForm.pricePerDay),
          license_plate: carForm.licensePlate
        })
      });
      setCarForm(INITIAL_CAR_FORM);
      setMessage('Car added.');
      await loadAll();
    } catch (err) {
      setError(err.message || 'Could not add car.');
    } finally {
      setBusy(false);
    }
  }

  async function addCustomer(e) {
    e.preventDefault();
    if (!customerForm.name || !customerForm.email || !customerForm.phone) {
      setError('Fill all required customer fields.');
      return;
    }
    try {
      setBusy(true);
      setError('');
      setMessage('');
      await fetchJson('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customerForm.name,
          email: customerForm.email,
          phone: customerForm.phone,
          licenseNumber: customerForm.licenseNumber
        })
      });
      setCustomerForm(INITIAL_CUSTOMER_FORM);
      setMessage('Customer added.');
      await loadAll();
    } catch (err) {
      setError(err.message || 'Could not add customer.');
    } finally {
      setBusy(false);
    }
  }

  async function createBooking(e) {
    e.preventDefault();
    if (!bookingForm.customerId || !bookingForm.carId) {
      setError('Select a customer and an available car.');
      return;
    }
    try {
      setBusy(true);
      setError('');
      setMessage('');
      await fetchJson('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: bookingForm.customerId,
          carId: bookingForm.carId,
          days: Number(bookingForm.days) || 1
        })
      });
      setBookingForm((prev) => ({ ...prev, carId: '', days: 1 }));
      setMessage('Booking created.');
      await loadAll();
    } catch (err) {
      setError(err.message || 'Could not create booking.');
    } finally {
      setBusy(false);
    }
  }

  async function cancelBooking(bookingId) {
    try {
      setBusy(true);
      setError('');
      setMessage('');
      await fetchJson('/api/bookings/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId })
      });
      setMessage('Booking cancelled.');
      await loadAll();
    } catch (err) {
      setError(err.message || 'Could not cancel booking.');
    } finally {
      setBusy(false);
    }
  }

  async function markReturned(bookingId) {
    try {
      setBusy(true);
      setError('');
      setMessage('');
      await fetchJson('/api/bookings/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId })
      });
      setMessage('Booking marked as returned.');
      await loadAll();
    } catch (err) {
      setError(err.message || 'Could not mark booking as returned.');
    } finally {
      setBusy(false);
    }
  }

  function resolveBookingEmail(booking) {
    const customer = customers.find((entry) => entry.customerId === booking.customerId);
    if (customer?.email) {
      return customer.email;
    }
    return authUser?.email || '';
  }

  function buildPaystackReference(bookingId) {
    return `${bookingId}-${Date.now()}`;
  }

  async function verifyPaystackPayment(reference) {
    try {
      setBusy(true);
      setError('');
<<<<<<< HEAD
      setMessage('');
      await fetchJson('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, paymentMethod })
      });
      setMessage('Payment completed.');
=======
      setMessage('Verifying Paystack payment...');

      const result = await fetchJson(`/api/payments/verify?reference=${encodeURIComponent(reference)}`);
      setMessage(result.alreadyPaid ? 'Payment already verified.' : 'Paystack payment verified.');
>>>>>>> cf23647 (Improve landing page, auth flow, and Paystack booking payments)
      await loadAll();
    } catch (err) {
      setError(err.message || 'Could not verify Paystack payment.');
    } finally {
      setBusy(false);
    }
  }

  function selectCarForBooking(carId) {
    setActiveView('bookings');
    setBookingForm((prev) => ({
      ...prev,
      carId,
      customerId: role === 'user' ? userCustomerId : prev.customerId
    }));
  }

  function getRentalDays(booking) {
    if (!booking?.startDate || !booking?.endDate) return '-';
    const start = new Date(booking.startDate);
    const end = new Date(booking.endDate);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    return Math.max(diff, 1);
  }

  async function handleLogout() {
    await signOut(auth);
    setAuthView('home');
    setRole(null);
    setUserCustomerId('');
    setBookingForm({ customerId: '', carId: '', days: 1 });
    setError('');
    setMessage('');
  }

  if (!authReady) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <p className="status">Checking session...</p>
        </section>
      </main>
    );
  }

  if (!authUser) {
    if (authView === 'login') return <Login initialMode="login" onBack={() => setAuthView('home')} />;
    if (authView === 'signup') return <Login initialMode="signup" onBack={() => setAuthView('home')} />;
    return <MarketingHome onLogin={() => setAuthView('login')} onSignup={() => setAuthView('signup')} />;
  }

  if (!role) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <p className="status error">{error || 'No valid role found for this account.'}</p>
          <button type="button" onClick={handleLogout}>Sign Out</button>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <p className="brand-title">DriveDesk</p>
          <p className="brand-sub">{role === 'admin' ? 'Admin Console' : 'User Console'}</p>
        </div>
        <nav className="side-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${activeView === item.id ? 'active' : ''}`}
              onClick={() => setActiveView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="side-meta">
          <p>{authUser.email}</p>
          <p>Cars: {dashboard.totalCars}</p>
          <p>Available: {dashboard.availableCarsToday}</p>
          <button type="button" className="ghost back-home" onClick={handleLogout}>Logout</button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="top-bar">
          <div>
            <h1>{navItems.find((i) => i.id === activeView)?.label}</h1>
            <p>Manage bookings, customers, and fleet operations in one place.</p>
          </div>
          <div className="search-wrap">
            <input
              placeholder="Search cars, customers, bookings"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="button" onClick={loadAll} disabled={busy}>Refresh</button>
          </div>
        </header>

        {loading && <p className="status">Loading...</p>}
        {error && <p className="status error">{error}</p>}
        {message && <p className="status success">{message}</p>}

        {!loading && (
          <>
            {activeView === 'dashboard' && (
              <section className="content-grid">
                <div className="stats-row">
                  {role === 'admin' ? (
                    <>
                      <article className="stat-card"><h3>Total Cars</h3><strong>{dashboard.totalCars}</strong></article>
                      <article className="stat-card"><h3>Customers</h3><strong>{dashboard.totalCustomers}</strong></article>
                      <article className="stat-card"><h3>Available</h3><strong>{dashboard.availableCarsToday}</strong></article>
                      <article className="stat-card"><h3>Revenue</h3><strong>{currency.format(dashboard.totalRevenue)}</strong></article>
                    </>
                  ) : (
                    <>
                      <article className="stat-card"><h3>My Bookings</h3><strong>{userStats.myTotalBookings}</strong></article>
                      <article className="stat-card"><h3>My Active</h3><strong>{userStats.myActiveBookings}</strong></article>
                      <article className="stat-card"><h3>Outstanding</h3><strong>{currency.format(userStats.myUnpaidAmount)}</strong></article>
                      <article className="stat-card"><h3>Available Cars</h3><strong>{dashboard.availableCarsToday}</strong></article>
                    </>
                  )}
                </div>
                <section className="panel">
                  <h2>Available Cars</h2>
                  <div className="car-list">
                    {availableCars.map((car) => (
                      <article key={car.carId} className="car-item">
                        <h4>{car.year} {car.make} {car.model}</h4>
                        <p>{car.carId} • {car.category} • {currency.format(car.pricePerDay)}/day</p>
                        <button type="button" disabled={busy} onClick={() => selectCarForBooking(car.carId)}>
                          Start Booking
                        </button>
                      </article>
                    ))}
                    {availableCars.length === 0 && <p className="empty">No cars currently available.</p>}
                  </div>
                </section>
              </section>
            )}

            {activeView === 'fleet' && (
              <section className="panel">
                <h2>Fleet Listing</h2>
                <table>
                  <thead><tr><th>ID</th><th>Vehicle</th><th>Category</th><th>Rate/Day</th><th>Status</th></tr></thead>
                  <tbody>
                    {filteredCars.map((car) => (
                      <tr key={car.carId}>
                        <td>{car.carId}</td>
                        <td>{car.year} {car.make} {car.model}</td>
                        <td>{car.category}</td>
                        <td>{currency.format(car.pricePerDay)}</td>
                        <td><span className={`badge ${car.status === 'Available' ? 'ok' : 'warn'}`}>{car.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {role === 'admin' && activeView === 'customers' && (
              <section className="panel">
                <h2>Customers</h2>
                <table>
                  <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th></tr></thead>
                  <tbody>
                    {filteredCustomers.map((customer) => (
                      <tr key={customer.customerId}>
                        <td>{customer.customerId}</td>
                        <td>{customer.name}</td>
                        <td>{customer.email}</td>
                        <td>{customer.phone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {activeView === 'bookings' && (
              <div className="content-grid">
                <section className="panel">
                  <h2>Create Booking</h2>
                  {role === 'user' && !linkedCustomer && (
                    <p className="status">Setting up your customer profile...</p>
                  )}
                  <form className="form-grid" onSubmit={createBooking}>
                    {role === 'admin' ? (
                      <select
                        value={bookingForm.customerId}
                        onChange={(e) => setBookingForm((p) => ({ ...p, customerId: e.target.value }))}
                      >
                        <option value="">Select customer</option>
                        {customers.map((c) => (
                          <option key={c.customerId} value={c.customerId}>{c.customerId} - {c.name}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="locked-field">
                        <strong>{linkedCustomer ? linkedCustomer.name : authUser.email}</strong>
                        <span>
                          {linkedCustomer
                            ? `${linkedCustomer.customerId} • ${linkedCustomer.email}`
                            : 'Your customer profile is being created automatically'}
                        </span>
                      </div>
                    )}
                    <select
                      value={bookingForm.carId}
                      onChange={(e) => setBookingForm((p) => ({ ...p, carId: e.target.value }))}
                    >
                      <option value="">Select available car</option>
                      {availableCars.map((c) => (
                        <option key={c.carId} value={c.carId}>{c.carId} - {c.make} {c.model}</option>
                      ))}
                    </select>
                    <input
                      placeholder="Hire days"
                      type="number"
                      min="1"
                      value={bookingForm.days}
                      onChange={(e) => setBookingForm((p) => ({ ...p, days: e.target.value }))}
                    />
<<<<<<< HEAD
                    <button type="submit" disabled={busy}>Create Booking</button>
=======

                    <button type="submit" disabled={busy || (role === 'user' && !linkedCustomer)}>Create Booking</button>
>>>>>>> cf23647 (Improve landing page, auth flow, and Paystack booking payments)
                  </form>
                </section>

                <section className="panel">
                  <h2>{role === 'admin' ? 'Bookings List' : 'My Bookings'}</h2>
                  <table>
                    <thead><tr><th>Booking ID</th><th>Customer</th><th>Car</th><th>Status</th><th>Days</th><th>Payment</th><th>Total</th><th>Action</th></tr></thead>
                    <tbody>
                      {visibleBookings.map((booking) => (
                        <tr key={booking.bookingId}>
                          <td>{booking.bookingId}</td>
                          <td>{booking.customerId}</td>
                          <td>{booking.carId}</td>
                          <td>
                            <span className={`badge ${booking.status === 'Confirmed' ? 'ok' : 'warn'}`}>
                              {booking.status === 'Confirmed' ? 'Active' : booking.status}
                            </span>
                          </td>
                          <td>{getRentalDays(booking)}</td>
                          <td>
                            <span className={`badge ${booking.paymentStatus === 'Paid' ? 'ok' : 'warn'}`}>
                              {booking.paymentStatus || 'Unpaid'}
                            </span>
                          </td>
                          <td>{currency.format(booking.totalAmount)}</td>
                          <td>
                            <div className="row-actions">
                              <PaystackPay
                                email={resolveBookingEmail(booking)}
                                amount={booking.totalAmount}
                                reference={buildPaystackReference(booking.bookingId)}
                                className="paystack-button"
                                disabled={busy || booking.status !== 'Confirmed' || booking.paymentStatus === 'Paid'}
                                onSuccess={(reference) => verifyPaystackPayment(reference?.reference || reference)}
                              />
                              {role === 'admin' && (
                                <button
                                  type="button"
                                  className="ghost"
                                  disabled={busy || booking.status !== 'Confirmed'}
                                  onClick={() => markReturned(booking.bookingId)}
                                >
                                  Mark Returned
                                </button>
                              )}
                              {role === 'admin' && (
                                <button
                                  type="button"
                                  className="ghost"
                                  disabled={busy || booking.status !== 'Confirmed'}
                                  onClick={() => cancelBooking(booking.bookingId)}
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {visibleBookings.length === 0 && (
                        <tr><td colSpan="8">No bookings found for this profile.</td></tr>
                      )}
                    </tbody>
                  </table>
                </section>
              </div>
            )}

            {role === 'admin' && activeView === 'admin' && (
              <div className="content-grid two-col">
                <section className="panel">
                  <h2>Add Car</h2>
                  <form className="form-grid" onSubmit={addCar}>
                    <input placeholder="Make" value={carForm.make} onChange={(e) => setCarForm((p) => ({ ...p, make: e.target.value }))} />
                    <input placeholder="Model" value={carForm.model} onChange={(e) => setCarForm((p) => ({ ...p, model: e.target.value }))} />
                    <input placeholder="Year" type="number" min="1990" value={carForm.year} onChange={(e) => setCarForm((p) => ({ ...p, year: e.target.value }))} />
                    <input placeholder="Category" value={carForm.category} onChange={(e) => setCarForm((p) => ({ ...p, category: e.target.value }))} />
                    <input placeholder="Price / day" type="number" min="1" value={carForm.pricePerDay} onChange={(e) => setCarForm((p) => ({ ...p, pricePerDay: e.target.value }))} />
                    <input placeholder="License plate" value={carForm.licensePlate} onChange={(e) => setCarForm((p) => ({ ...p, licensePlate: e.target.value }))} />
                    <button type="submit" disabled={busy}>Add Car</button>
                  </form>
                </section>
                <section className="panel">
                  <h2>Add Customer</h2>
                  <form className="form-grid" onSubmit={addCustomer}>
                    <input placeholder="Name" value={customerForm.name} onChange={(e) => setCustomerForm((p) => ({ ...p, name: e.target.value }))} />
                    <input placeholder="Email" value={customerForm.email} onChange={(e) => setCustomerForm((p) => ({ ...p, email: e.target.value }))} />
                    <input placeholder="Phone" value={customerForm.phone} onChange={(e) => setCustomerForm((p) => ({ ...p, phone: e.target.value }))} />
                    <input placeholder="License number" value={customerForm.licenseNumber} onChange={(e) => setCustomerForm((p) => ({ ...p, licenseNumber: e.target.value }))} />
                    <button type="submit" disabled={busy}>Add Customer</button>
                  </form>
                </section>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}