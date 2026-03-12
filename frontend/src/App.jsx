import { useEffect, useMemo, useState } from 'react';
import landingCarImage from './assets/landing-car.jpg';
import carHireImage from './assets/car-hire.jpg';

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

function MarketingHome({ onEnterApp }) {
  return (
    <main className="marketing-page">
      <header className="marketing-nav">
        <p className="marketing-logo">DriveDesk</p>
        <button type="button" className="marketing-cta" onClick={() => onEnterApp('user')}>
          Enter as User
        </button>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">Modern Rental Operations</p>
          <h1>Run your car rental business in one clean workspace.</h1>
          <p>
            DriveDesk handles bookings, fleet tracking, customer records, and admin actions with a dashboard
            built for speed.
          </p>
          <div className="hero-actions">
            <button type="button" className="marketing-cta" onClick={() => onEnterApp('user')}>
              Enter as User
            </button>
            <button type="button" className="marketing-cta ghost-cta" onClick={() => onEnterApp('admin')}>
              Enter as Admin
            </button>
            <span className="hero-note">Set up in minutes and start taking bookings.</span>
          </div>
          <img className="hero-inline-image" src={carHireImage} alt="Customer picking up a rental car" />
        </div>

        <div className="hero-card-grid">
          <article className="hero-image-card">
            <img
              src={landingCarImage}
              alt="Happy customer picking up a rental car"
            />
          </article>
          <div className="hero-features">
            <article>
              <h3>Live Booking Control</h3>
              <p>Create and cancel bookings instantly while availability updates in real time.</p>
            </article>
            <article>
              <h3>Fleet Visibility</h3>
              <p>Track rented vs available cars and view rates across your fleet listings.</p>
            </article>
            <article>
              <h3>Customer Workspace</h3>
              <p>Manage customer profiles and launch bookings directly from a unified panel.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="marketing-strip">
        <article><strong>Dashboard</strong><span>Real-time cards and operational metrics.</span></article>
        <article><strong>Fleet</strong><span>Status-aware inventory with searchable records.</span></article>
        <article><strong>Admin</strong><span>Quick forms for adding cars and customers.</span></article>
      </section>
    </main>
  );
}

export default function App() {
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
  const [paymentMethodByBooking, setPaymentMethodByBooking] = useState({});
  const [userCustomerId, setUserCustomerId] = useState('');

  useEffect(() => {
    if (role) {
      loadAll();
    }
  }, [role]);

  const navItems = useMemo(() => NAV_ITEMS.filter((item) => item.roles.includes(role)), [role]);

  useEffect(() => {
    if (navItems.length > 0 && !navItems.some((item) => item.id === activeView)) {
      setActiveView(navItems[0].id);
    }
  }, [navItems, activeView]);

  useEffect(() => {
    if (role !== 'user') {
      return;
    }
    if (customers.length === 0) {
      setUserCustomerId('');
      return;
    }
    if (!userCustomerId || !customers.some((customer) => customer.customerId === userCustomerId)) {
      const firstCustomerId = customers[0].customerId;
      setUserCustomerId(firstCustomerId);
      setBookingForm((prev) => ({ ...prev, customerId: firstCustomerId }));
    }
  }, [role, customers, userCustomerId]);

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
    if (!needle) {
      return cars;
    }
    return cars.filter((c) => `${c.carId} ${c.make} ${c.model} ${c.category}`.toLowerCase().includes(needle));
  }, [cars, search]);

  const filteredCustomers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return customers;
    }
    return customers.filter((c) => `${c.customerId} ${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(needle));
  }, [customers, search]);

  const filteredBookings = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return bookings;
    }
    return bookings.filter((b) => `${b.bookingId} ${b.customerId} ${b.carId} ${b.status}`.toLowerCase().includes(needle));
  }, [bookings, search]);

  const visibleBookings = useMemo(() => {
    if (role !== 'user') {
      return filteredBookings;
    }
    if (!userCustomerId) {
      return [];
    }
    return filteredBookings.filter((booking) => booking.customerId === userCustomerId);
  }, [role, filteredBookings, userCustomerId]);

  const userBookings = useMemo(() => {
    if (!userCustomerId) {
      return [];
    }
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
      setCars(carsData || []);
      setCustomers(customersData || []);
      setBookings(bookingsData || []);
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
          pricePerDay: Number(carForm.pricePerDay),
          licensePlate: carForm.licensePlate
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

  async function payForBooking(bookingId) {
    const paymentMethod = paymentMethodByBooking[bookingId] || 'Card';
    try {
      setBusy(true);
      setError('');
      setMessage('');

      await fetchJson('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, paymentMethod })
      });

      setMessage('Payment completed.');
      await loadAll();
    } catch (err) {
      setError(err.message || 'Could not process payment.');
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
    if (!booking?.startDate || !booking?.endDate) {
      return '-';
    }
    const start = new Date(booking.startDate);
    const end = new Date(booking.endDate);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    return Math.max(diff, 1);
  }

  function enterApp(selectedRole) {
    setRole(selectedRole);
    setActiveView('dashboard');
    setUserCustomerId('');
    setBookingForm({ customerId: '', carId: '', days: 1 });
    setError('');
    setMessage('');
  }

  if (!role) {
    return <MarketingHome onEnterApp={enterApp} />;
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
          <p>Cars: {dashboard.totalCars}</p>
          <p>Available: {dashboard.availableCarsToday}</p>
          <button type="button" className="ghost back-home" onClick={() => setRole(null)}>Back to Site</button>
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
                      <select
                        value={userCustomerId}
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          setUserCustomerId(selectedId);
                          setBookingForm((p) => ({ ...p, customerId: selectedId }));
                        }}
                      >
                        <option value="">Select your profile</option>
                        {customers.map((c) => (
                          <option key={c.customerId} value={c.customerId}>{c.customerId} - {c.name}</option>
                        ))}
                      </select>
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

                    <button type="submit" disabled={busy}>Create Booking</button>
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
                              <select
                                value={paymentMethodByBooking[booking.bookingId] || 'Card'}
                                onChange={(e) =>
                                  setPaymentMethodByBooking((prev) => ({
                                    ...prev,
                                    [booking.bookingId]: e.target.value
                                  }))
                                }
                                disabled={busy || booking.status !== 'Confirmed' || booking.paymentStatus === 'Paid'}
                              >
                                <option value="Card">Card</option>
                                <option value="Mpesa">Mpesa</option>
                                <option value="Cash">Cash</option>
                              </select>
                              <button
                                type="button"
                                disabled={busy || booking.status !== 'Confirmed' || booking.paymentStatus === 'Paid'}
                                onClick={() => payForBooking(booking.bookingId)}
                              >
                                Pay
                              </button>
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
                        <tr>
                          <td colSpan="8">No bookings found for this profile.</td>
                        </tr>
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
