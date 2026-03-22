import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut, updateProfile } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import Login from './Login';
import PaystackPay from './PaystackPay';
import carHireImage from './assets/car-hire.jpg';
import landingCarImage from './assets/landing-car.jpg';
import driveDeskLogo from './assets/drive-desk.png';
import smartAssistantManImage from './assets/handsome-elegant-man-car-salon.jpg';
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

const INITIAL_RECOMMENDATION_FORM = {
  budget: '',
  passengers: 1,
  tripType: '',
  rentalDuration: 1,
  preferredCategory: ''
};

const DRIVER_OPTIONS = ['No driver', 'With driver'];
const PAYMENT_STATUS_OPTIONS = ['Unpaid', 'Paid'];
const BOOKING_STATUS_OPTIONS = ['Ongoing', 'Returned', 'Cancelled'];

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', roles: ['admin', 'user'] },
  { id: 'fleet', label: 'Fleet', roles: ['admin', 'user'] },
  { id: 'users', label: 'Users', roles: ['admin'] },
  { id: 'bookings', label: 'Bookings', roles: ['admin', 'user'] },
  { id: 'admin', label: 'Admin', roles: ['admin'] }
];

function resolveTimestampValue(value) {
  if (!value) {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value?.toMillis === 'function') {
    return value.toMillis();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function resolveDateObject(value) {
  if (!value) {
    return null;
  }
  if (typeof value?.toDate === 'function') {
    return value.toDate();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sortByCreatedAt(items) {
  return [...items].sort((a, b) => resolveTimestampValue(a.createdAt) - resolveTimestampValue(b.createdAt));
}

function nextSequentialId(items, field, prefix, width = 0) {
  const max = items.reduce((currentMax, item) => {
    const raw = String(item[field] || item.id || '');
    const numeric = raw.replace(/\D/g, '');
    if (!numeric) {
      return currentMax;
    }
    return Math.max(currentMax, Number(numeric));
  }, 0);

  const next = max + 1;
  if (width > 0) {
    return `${prefix}${String(next).padStart(width, '0')}`;
  }
  return `${prefix}${next}`;
}

function extractBookingId(reference) {
  return String(reference || '').split('-')[0];
}

function getDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createInitialBookingForm() {
  const today = getDateInputValue();
  return {
    customerId: '',
    carId: '',
    days: 1,
    startDate: today,
    endDate: today,
    driverOption: 'No driver',
    paymentStatus: 'Unpaid',
    status: 'Ongoing'
  };
}

function parseDateInput(value) {
  const [year, month, day] = String(value || '').split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
}

function calculateInclusiveDays(startValue, endValue) {
  const start = parseDateInput(startValue);
  const end = parseDateInput(endValue);
  if (!start || !end) {
    return 1;
  }
  const diff = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(diff + 1, 1);
}

function calculateEndDateFromDays(startValue, days) {
  const start = parseDateInput(startValue);
  if (!start) {
    return '';
  }
  const safeDays = Math.max(Number(days) || 1, 1);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + safeDays - 1);
  return getDateInputValue(end);
}

function isActiveBooking(status) {
  return status === 'Confirmed' || status === 'Ongoing';
}

function getBookingStatusLabel(status) {
  if (status === 'Confirmed') {
    return 'Ongoing';
  }
  return status || 'Ongoing';
}

function getBookingStatusTone(status) {
  const normalized = getBookingStatusLabel(status);
  if (normalized === 'Ongoing') {
    return 'ok';
  }
  if (normalized === 'Returned') {
    return 'info';
  }
  if (normalized === 'Cancelled') {
    return 'danger';
  }
  return 'warn';
}

function getCarStatusTone(status) {
  if (status === 'Available') {
    return 'ok';
  }
  if (status === 'Booked') {
    return 'warn';
  }
  if (status === 'Unavailable') {
    return 'danger';
  }
  return 'info';
}

function isRecoverablePaystackVerificationError(message) {
  const normalized = String(message || '').toLowerCase();
  return normalized.includes('booking not found for reference')
    || normalized.includes('booking not found for payment verification');
}

function formatBookingDate(value) {
  const date = resolveDateObject(value);
  if (!date || Number.isNaN(date.getTime())) {
    return '-';
  }
  return date.toLocaleDateString('en-KE', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatAdminDateTime(value) {
  const date = resolveDateObject(value);
  if (!date) {
    return '-';
  }
  return date.toLocaleString('en-KE', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function MarketingHome({ onLogin, onSignup }) {
  return (
    <main className="marketing-page">
      <header className="marketing-nav">
        <div className="brand-lockup marketing-logo-lockup">
          <img src={driveDeskLogo} alt="DriveDesk logo" className="brand-logo" />
          <p className="marketing-logo">DriveDesk</p>
        </div>
        <button type="button" className="marketing-cta" onClick={onSignup}>
          Sign up
        </button>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">Modern Rental Operations</p>
          <h1>Run your car rental business in one clean workspace.</h1>
          <p>
            DriveDesk handles bookings, fleet tracking, user profiles, and admin actions with a dashboard
            built for speed.
          </p>
          <div className="hero-actions">
            <button type="button" className="marketing-cta" onClick={onLogin}>
              Login
            </button>
            <button type="button" className="marketing-cta ghost-cta" onClick={onSignup}>
              Sign up
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
              <p>Admins manage fleet, payments, and user profiles, while users only see the actions relevant to them.</p>
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
      </section>
    </main>
  );
}

export default function App() {
  const [authView, setAuthView] = useState('home');
  const [authReady, setAuthReady] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [role, setRole] = useState(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [carSearch, setCarSearch] = useState('');
  const [carSearchInput, setCarSearchInput] = useState('');
  const [carStatusFilter, setCarStatusFilter] = useState('all');
  const [carStatusFilterInput, setCarStatusFilterInput] = useState('all');
  const [carCategoryFilter, setCarCategoryFilter] = useState('all');
  const [carCategoryFilterInput, setCarCategoryFilterInput] = useState('all');
  const [carSort, setCarSort] = useState('make-asc');
  const [carSortInput, setCarSortInput] = useState('make-asc');

  const [cars, setCars] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [bookings, setBookings] = useState([]);

  const [carForm, setCarForm] = useState(INITIAL_CAR_FORM);
  const [bookingForm, setBookingForm] = useState(createInitialBookingForm());
  const [recommendationForm, setRecommendationForm] = useState(INITIAL_RECOMMENDATION_FORM);
  const [recommendationBusy, setRecommendationBusy] = useState(false);
  const [recommendationError, setRecommendationError] = useState('');
  const [recommendationResult, setRecommendationResult] = useState(null);
  const [userProfileId, setUserProfileId] = useState('');
  const [provisioningProfile, setProvisioningProfile] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setAuthUser(currentUser);
      setError('');
      setMessage('');
      setActiveView('dashboard');

      if (!currentUser) {
        setRole(null);
        setRoleLoading(false);
        setCars([]);
        setProfiles([]);
        setBookings([]);
        setUserProfileId('');
        setLoading(false);
        setAuthReady(true);
        return;
      }

      setAuthReady(false);
      setRole(null);
      setUserProfileId('');
      setRoleLoading(true);

      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.data() || {};
        const resolvedRole = userDoc.data()?.role;
        if (resolvedRole !== 'admin' && resolvedRole !== 'user') {
          throw new Error('Your account has no valid role. Set role in Firestore users/{uid}.');
        }
        if (userData.name && currentUser.displayName !== userData.name) {
          await updateProfile(currentUser, { displayName: userData.name });
        }
        setRole(resolvedRole);
        setError('');
      } catch (err) {
        setRole(null);
        setError(err.message || 'Could not determine user role.');
      } finally {
        setRoleLoading(false);
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!role) {
      return undefined;
    }

    setLoading(true);
    setError('');

    let active = true;
    const ready = {
      cars: false,
      profiles: false,
      bookings: false
    };

    function finishIfReady() {
      if (!active) {
        return;
      }
      if (ready.cars && ready.profiles && ready.bookings) {
        setLoading(false);
      }
    }

    const stopCars = onSnapshot(
      collection(db, 'cars'),
      (snapshot) => {
        if (!active) {
          return;
        }
        const carsData = sortByCreatedAt(snapshot.docs.map((entry) => ({
          carId: entry.id,
          status: 'Available',
          ...entry.data()
        })));
        setCars(carsData);
        ready.cars = true;
        finishIfReady();
      },
      (err) => {
        if (!active) {
          return;
        }
        setError(err.message || 'Could not load cars right now.');
        ready.cars = true;
        finishIfReady();
      }
    );

    const stopProfiles = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        if (!active) {
          return;
        }
        const profilesData = sortByCreatedAt(snapshot.docs.map((entry) => ({
          id: entry.id,
          ...entry.data()
        })));
        setProfiles(profilesData);
        ready.profiles = true;
        finishIfReady();
      },
      (err) => {
        if (!active) {
          return;
        }
        setError(err.message || 'Could not load users right now.');
        ready.profiles = true;
        finishIfReady();
      }
    );

    const stopBookings = onSnapshot(
      collection(db, 'bookings'),
      (snapshot) => {
        if (!active) {
          return;
        }
        const bookingsData = sortByCreatedAt(snapshot.docs.map((entry) => ({
          bookingId: entry.id,
          ...entry.data()
        })));
        setBookings(bookingsData);
        ready.bookings = true;
        finishIfReady();
      },
      (err) => {
        if (!active) {
          return;
        }
        setError(err.message || 'Could not load bookings right now.');
        ready.bookings = true;
        finishIfReady();
      }
    );

    return () => {
      active = false;
      stopCars();
      stopProfiles();
      stopBookings();
    };
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

    const bookingId = extractBookingId(reference);
    const callbackBooking = bookings.find((entry) => entry.bookingId === bookingId);
    if (!callbackBooking) {
      return;
    }

    let ignore = false;

    async function verifyPayment() {
      try {
        setBusy(true);
        setError('');
        setMessage('Verifying Paystack payment...');
        if (ignore) {
          return;
        }

        const verifiedWithBackend = await completePaystackPayment(reference, callbackBooking);
        if (ignore) {
          return;
        }

        setMessage(verifiedWithBackend ? 'Paystack payment verified.' : 'Paystack payment confirmed.');
      } catch (err) {
        if (ignore) {
          return;
        }
        setMessage('');
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
  }, [authReady, authUser, bookings]);

  const navItems = useMemo(() => NAV_ITEMS.filter((item) => item.roles.includes(role)), [role]);

  useEffect(() => {
    if (navItems.length > 0 && !navItems.some((item) => item.id === activeView)) {
      setActiveView(navItems[0].id);
    }
  }, [navItems, activeView]);

  useEffect(() => {
    setSearch('');
    setSearchInput('');
    setCarSearch('');
    setCarSearchInput('');
    setCarStatusFilter('all');
    setCarStatusFilterInput('all');
    setCarCategoryFilter('all');
    setCarCategoryFilterInput('all');
    setCarSort('make-asc');
    setCarSortInput('make-asc');
  }, [activeView]);

  const userProfiles = useMemo(
    () => profiles.filter((profile) => profile.role === 'user'),
    [profiles]
  );

  const currentUserProfile = useMemo(() => {
    if (!authUser?.uid) {
      return null;
    }
    return profiles.find((profile) => profile.id === authUser.uid) || null;
  }, [authUser, profiles]);

  const linkedCustomer = useMemo(() => {
    if (role !== 'user') {
      return null;
    }
    return currentUserProfile;
  }, [currentUserProfile, role]);

  useEffect(() => {
    if (role !== 'user' || !authUser?.uid || loading || provisioningProfile) {
      return;
    }
    if (currentUserProfile) {
      return;
    }

    let ignore = false;

    async function provisionCustomerProfile() {
      try {
        setProvisioningProfile(true);
        setError('');

        const existingProfileDoc = await getDoc(doc(db, 'users', authUser.uid));
        if (existingProfileDoc.exists()) {
          const existingProfile = { id: authUser.uid, ...existingProfileDoc.data() };

          if (!ignore) {
            if (existingProfile.name && authUser.displayName !== existingProfile.name) {
              await updateProfile(authUser, { displayName: existingProfile.name });
            }

            setProfiles((prev) => {
              const exists = prev.some((profile) => profile.id === authUser.uid);
              if (exists) {
                return prev.map((profile) => (
                  profile.id === authUser.uid ? { ...profile, ...existingProfile } : profile
                ));
              }
              return [...prev, existingProfile];
            });
            setUserProfileId(authUser.uid);
            setBookingForm((prev) => ({ ...prev, customerId: authUser.uid }));
          }
          return;
        }

        const fallbackName = authUser.displayName || authUser.email.split('@')[0] || 'Customer';
        const createdCustomer = {
          name: fallbackName,
          email: authUser.email,
          role: 'user',
          createdAt: Date.now()
        };

        await setDoc(doc(db, 'users', authUser.uid), createdCustomer, { merge: true });

        if (ignore) {
          return;
        }

        setProfiles((prev) => {
          const exists = prev.some((profile) => profile.id === authUser.uid);
          if (exists) {
            return prev.map((profile) => (
              profile.id === authUser.uid ? { ...profile, ...createdCustomer, id: authUser.uid } : profile
            ));
          }
          return [...prev, { id: authUser.uid, ...createdCustomer }];
        });
        setUserProfileId(authUser.uid);
        setBookingForm((prev) => ({ ...prev, customerId: authUser.uid }));
      } catch (err) {
        if (ignore) {
          return;
        }
        setError(err.message || 'Could not set up your user profile.');
      } finally {
        if (ignore) {
          return;
        }
        setProvisioningProfile(false);
      }
    }

    provisionCustomerProfile();

    return () => {
      ignore = true;
    };
  }, [authUser, currentUserProfile, loading, provisioningProfile, role]);

  useEffect(() => {
    if (role !== 'user') {
      return;
    }
    if (!authUser?.uid) {
      setUserProfileId('');
      return;
    }
    if (profiles.some((profile) => profile.id === authUser.uid)) {
      setUserProfileId(authUser.uid);
      setBookingForm((prev) => ({ ...prev, customerId: authUser.uid }));
    }
  }, [authUser, profiles, role]);

  useEffect(() => {
    if (linkedCustomer && message === 'Setting up your user profile...') {
      setMessage('');
    }
  }, [linkedCustomer, message]);

  useEffect(() => {
    if (loading || cars.length === 0) {
      return;
    }

    const activeCarIds = new Set(
      bookings
        .filter((booking) => isActiveBooking(booking.status))
        .map((booking) => booking.carId)
    );

    const pendingUpdates = cars
      .map((car) => ({
        carId: car.carId,
        currentStatus: car.status,
        nextStatus: activeCarIds.has(car.carId)
          ? 'Booked'
          : (car.status === 'Unavailable' ? 'Unavailable' : 'Available')
      }))
      .filter((entry) => entry.currentStatus !== entry.nextStatus);

    if (pendingUpdates.length === 0) {
      return;
    }

    let ignore = false;

    async function syncCarStatuses() {
      try {
        const batch = writeBatch(db);
        pendingUpdates.forEach((entry) => {
          batch.update(doc(db, 'cars', entry.carId), {
            status: entry.nextStatus
          });
        });
        await batch.commit();
      } catch (err) {
        if (!ignore) {
          setError(err.message || 'Could not sync car statuses.');
        }
      }
    }

    syncCarStatuses();

    return () => {
      ignore = true;
    };
  }, [bookings, cars, loading]);

  useEffect(() => {
    if (loading || bookings.length === 0) {
      return;
    }

    const pendingRateBackfill = bookings
      .filter((booking) => !Number(booking.pricePerDayAtBooking))
      .map((booking) => {
        const days = Number(booking.days) || 0;
        const totalAmount = Number(booking.totalAmount) || 0;
        if (days <= 0 || totalAmount <= 0) {
          return null;
        }
        return {
          bookingId: booking.bookingId,
          pricePerDayAtBooking: Math.round(totalAmount / days)
        };
      })
      .filter(Boolean);

    if (pendingRateBackfill.length === 0) {
      return;
    }

    let ignore = false;

    async function syncBookingRates() {
      try {
        const batch = writeBatch(db);
        pendingRateBackfill.forEach((entry) => {
          batch.set(doc(db, 'bookings', entry.bookingId), {
            pricePerDayAtBooking: entry.pricePerDayAtBooking
          }, { merge: true });
        });
        await batch.commit();
      } catch (err) {
        if (!ignore) {
          setError(err.message || 'Could not sync booking rates.');
        }
      }
    }

    syncBookingRates();

    return () => {
      ignore = true;
    };
  }, [bookings, loading]);

  const availableCars = useMemo(() => cars.filter((car) => car.status === 'Available'), [cars]);

  const dashboard = useMemo(() => {
    const totalCars = cars.length;
    const totalCustomers = userProfiles.length;
    const activeBookingsToday = bookings.filter((b) => isActiveBooking(b.status)).length;
    const availableCarsToday = availableCars.length;
    const totalRevenue = bookings
      .filter((b) => isActiveBooking(b.status) && b.paymentStatus === 'Paid')
      .reduce((sum, b) => sum + Number(b.totalAmount || 0), 0);

    return { totalCars, totalCustomers, activeBookingsToday, availableCarsToday, totalRevenue };
  }, [cars, userProfiles, bookings, availableCars]);

  const filteredCars = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return cars.filter((c) => {
      if (!needle) {
        return true;
      }
      return `${c.carId} ${c.make} ${c.model} ${c.category} ${c.status} ${c.licensePlate || ''}`
        .toLowerCase()
        .includes(needle);
    });
  }, [cars, search]);

  const carCategories = useMemo(
    () => [...new Set(cars.map((car) => car.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [cars]
  );

  const carStatuses = useMemo(
    () => [...new Set(cars.map((car) => car.status).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [cars]
  );

  const visibleFleetCars = useMemo(() => {
    const needle = carSearch.trim().toLowerCase();

    const result = filteredCars.filter((car) => {
      const matchesSearch = !needle || `${car.carId} ${car.make} ${car.model} ${car.category} ${car.status} ${car.licensePlate || ''}`
        .toLowerCase()
        .includes(needle);
      const matchesStatus = carStatusFilter === 'all' || car.status === carStatusFilter;
      const matchesCategory = carCategoryFilter === 'all' || car.category === carCategoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });

    return [...result].sort((a, b) => {
      switch (carSort) {
        case 'rate-desc':
          return Number(b.pricePerDay) - Number(a.pricePerDay);
        case 'rate-asc':
          return Number(a.pricePerDay) - Number(b.pricePerDay);
        case 'year-desc':
          return Number(b.year) - Number(a.year);
        case 'year-asc':
          return Number(a.year) - Number(b.year);
        case 'make-desc':
          return `${b.make} ${b.model}`.localeCompare(`${a.make} ${a.model}`);
        case 'make-asc':
        default:
          return `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`);
      }
    });
  }, [filteredCars, carSearch, carStatusFilter, carCategoryFilter, carSort]);

  const filteredCustomers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return userProfiles;
    }
    return userProfiles.filter((c) => `${c.id} ${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(needle));
  }, [userProfiles, search]);

  const filteredBookings = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return bookings;
    }
    return bookings.filter((b) => {
      const bookingUser = profiles.find((profile) => profile.id === b.customerId);
      return `${b.bookingId} ${b.customerId} ${bookingUser?.name || ''} ${resolveCarLabel(b.carId)} ${b.status}`
        .toLowerCase()
        .includes(needle);
    });
  }, [bookings, profiles, search]);

  const visibleBookings = useMemo(() => {
    if (role !== 'user') {
      return filteredBookings;
    }
    if (!userProfileId) {
      return [];
    }
    return filteredBookings.filter((booking) => booking.customerId === userProfileId);
  }, [role, filteredBookings, userProfileId]);

  const userBookings = useMemo(() => {
    if (!userProfileId) {
      return [];
    }
    return bookings.filter((booking) => booking.customerId === userProfileId);
  }, [bookings, userProfileId]);

  const userStats = useMemo(() => {
    const myTotalBookings = userBookings.length;
    const myActiveBookings = userBookings.filter((booking) => isActiveBooking(booking.status)).length;
    const myUnpaidAmount = userBookings
      .filter((booking) => isActiveBooking(booking.status) && booking.paymentStatus !== 'Paid')
      .reduce((sum, booking) => sum + Number(booking.totalAmount || 0), 0);
    const myPaidBookings = userBookings.filter((booking) => booking.paymentStatus === 'Paid').length;

    return { myTotalBookings, myActiveBookings, myUnpaidAmount, myPaidBookings };
  }, [userBookings]);

  const recommendationCategories = useMemo(
    () => [...new Set(availableCars.map((car) => car.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [availableCars]
  );

  const userDashboardData = useMemo(() => {
    const recentBooking = [...userBookings]
      .sort((a, b) => resolveTimestampValue(b.createdAt) - resolveTimestampValue(a.createdAt))[0] || null;

    return {
      availableCarsCount: availableCars.length,
      favouriteCategories: recommendationCategories.slice(0, 3),
      recentBookingLabel: recentBooking ? resolveCarLabel(recentBooking.carId) : 'No bookings yet'
    };
  }, [availableCars, recommendationCategories, userBookings]);

  const adminDashboardData = useMemo(() => {
    const ongoingCount = bookings.filter((booking) => isActiveBooking(booking.status)).length;
    const returnedCount = bookings.filter((booking) => getBookingStatusLabel(booking.status) === 'Returned').length;
    const cancelledCount = bookings.filter((booking) => getBookingStatusLabel(booking.status) === 'Cancelled').length;
    const paidBookings = bookings.filter((booking) => booking.paymentStatus === 'Paid');
    const unpaidBookings = bookings.filter((booking) => (
      isActiveBooking(booking.status) && booking.paymentStatus !== 'Paid'
    ));
    const paidRevenue = paidBookings.reduce((sum, booking) => sum + Number(booking.totalAmount || 0), 0);
    const outstandingRevenue = unpaidBookings.reduce((sum, booking) => sum + Number(booking.totalAmount || 0), 0);
    const utilizationRate = dashboard.totalCars ? Math.round((ongoingCount / dashboard.totalCars) * 100) : 0;
    const hireBase = Math.max(ongoingCount + returnedCount + cancelledCount, 1);
    const hiredPercent = Math.round(((ongoingCount + returnedCount) / hireBase) * 100);
    const cancelledPercent = Math.round((cancelledCount / hireBase) * 100);
    const pendingPercent = Math.max(100 - hiredPercent - cancelledPercent, 0);

    const recentBookings = [...bookings]
      .sort((a, b) => resolveTimestampValue(b.createdAt) - resolveTimestampValue(a.createdAt))
      .slice(0, 5)
      .map((booking) => ({
        ...booking,
        customerName: profiles.find((profile) => profile.id === booking.customerId)?.name || booking.customerId,
        carName: resolveCarLabel(booking.carId)
      }));

    const monthBuckets = Array.from({ length: 6 }, (_, index) => {
      const bucketDate = new Date();
      bucketDate.setDate(1);
      bucketDate.setMonth(bucketDate.getMonth() - (5 - index));
      const label = bucketDate.toLocaleDateString('en-KE', { month: 'short' });
      const total = bookings.reduce((sum, booking) => {
        const bookingDate = resolveDateObject(booking.createdAt);
        if (!bookingDate) {
          return sum;
        }
        if (getBookingStatusLabel(booking.status) === 'Cancelled') {
          return sum;
        }
        if (
          bookingDate.getMonth() === bucketDate.getMonth() &&
          bookingDate.getFullYear() === bucketDate.getFullYear()
        ) {
          return sum + Number(booking.totalAmount || 0);
        }
        return sum;
      }, 0);

      return {
        label,
        total,
        height: 28
      };
    });

    const maxMonthTotal = Math.max(...monthBuckets.map((bucket) => bucket.total), 1);
    const monthlyTrend = monthBuckets.map((bucket) => ({
      ...bucket,
      height: Math.max(28, Math.round((bucket.total / maxMonthTotal) * 180))
    }));

    return {
      paidRevenue,
      outstandingRevenue,
      utilizationRate,
      ongoingCount,
      returnedCount,
      cancelledCount,
      hiredPercent,
      cancelledPercent,
      pendingPercent,
      recentBookings,
      monthlyTrend
    };
  }, [bookings, dashboard.totalCars, profiles]);

  const shouldShowSearch = useMemo(() => {
    if (activeView === 'fleet' || activeView === 'bookings') {
      return true;
    }
    return role === 'admin' && activeView === 'users';
  }, [activeView, role]);

  const searchPlaceholder = useMemo(() => {
    if (role === 'admin' && activeView === 'dashboard') {
      return 'Search cars, bookings, users';
    }
    if (activeView === 'fleet') {
      return 'Search fleet by ID, make, or model';
    }
    if (activeView === 'bookings') {
      return role === 'admin' ? 'Search bookings by ID, user, or car' : 'Search my bookings';
    }
    if (role === 'admin' && activeView === 'users') {
      return 'Search users by name, email, or phone';
    }
    return 'Search';
  }, [activeView, role]);

  const showHeaderSearch = (shouldShowSearch || (role === 'admin' && activeView === 'dashboard'))
    && !(role !== 'admin' && activeView === 'fleet');

  function handleSearchSubmit(e) {
    e.preventDefault();
    setSearch(searchInput.trim());
  }

  function handleFleetSearchSubmit(e) {
    e.preventDefault();
    setCarSearch(carSearchInput.trim());
    setCarStatusFilter(carStatusFilterInput);
    setCarCategoryFilter(carCategoryFilterInput);
    setCarSort(carSortInput);
  }

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
      console.error('[fetchJson] request failed', {
        url,
        status: res.status,
        responseText: text,
        responseJson: data
      });
      const msg = data?.error || `Request failed (${res.status})`;
      throw new Error(msg);
    }

    return data;
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

      const carId = nextSequentialId(cars, 'carId', 'C', 3);
      await setDoc(doc(db, 'cars', carId), {
        carId,
        make: carForm.make.trim(),
        model: carForm.model.trim(),
        year: Number(carForm.year),
        category: carForm.category.trim(),
        pricePerDay: Number(carForm.pricePerDay),
        licensePlate: carForm.licensePlate.trim() || 'N/A',
        status: 'Available',
        createdAt: Date.now()
      });

      setCarForm(INITIAL_CAR_FORM);
      setMessage('Car added.');
    } catch (err) {
      setError(err.message || 'Could not add car.');
    } finally {
      setBusy(false);
    }
  }

  function updateBookingFormField(field, value) {
    setBookingForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateRecommendationFormField(field, value) {
    setRecommendationForm((prev) => ({ ...prev, [field]: value }));
    setRecommendationResult(null);
    setRecommendationError('');
  }

  function handleBookingDaysChange(value) {
    setBookingForm((prev) => {
      const safeDays = Math.max(Number(value) || 1, 1);
      const startDate = prev.startDate || getDateInputValue();
      return {
        ...prev,
        days: safeDays,
        endDate: calculateEndDateFromDays(startDate, safeDays)
      };
    });
  }

  function handleBookingStartDateChange(value) {
    setBookingForm((prev) => {
      const safeStartDate = value || getDateInputValue();
      const safeDays = Math.max(Number(prev.days) || 1, 1);
      return {
        ...prev,
        startDate: safeStartDate,
        endDate: calculateEndDateFromDays(safeStartDate, safeDays)
      };
    });
  }

  function handleBookingEndDateChange(value) {
    setBookingForm((prev) => {
      const safeEndDate = value || prev.startDate;
      return {
        ...prev,
        endDate: safeEndDate,
        days: calculateInclusiveDays(prev.startDate, safeEndDate)
      };
    });
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

      const startDateValue = role === 'admin'
        ? (bookingForm.startDate || getDateInputValue())
        : getDateInputValue();
      const safeDays = Math.max(Number(bookingForm.days) || 1, 1);
      const endDateValue = role === 'admin'
        ? (bookingForm.endDate || calculateEndDateFromDays(startDateValue, safeDays))
        : calculateEndDateFromDays(startDateValue, safeDays);
      const days = role === 'admin'
        ? calculateInclusiveDays(startDateValue, endDateValue)
        : safeDays;
      const customer = userProfiles.find((entry) => entry.id === bookingForm.customerId);
      const car = cars.find((entry) => entry.carId === bookingForm.carId);
      const startDate = parseDateInput(startDateValue);
      const endDate = parseDateInput(endDateValue);
      const driverOption = role === 'admin' ? bookingForm.driverOption : 'No driver';
      const paymentStatus = role === 'admin' ? bookingForm.paymentStatus : 'Unpaid';
      const bookingStatus = role === 'admin' ? getBookingStatusLabel(bookingForm.status) : 'Ongoing';
      const pricePerDayAtBooking = Number(car?.pricePerDay) || 0;

      if (!customer) {
        throw new Error('Unknown customer selected.');
      }
      if (!car) {
        throw new Error('Unknown car selected.');
      }
      if (!startDate || !endDate) {
        throw new Error('Select a valid start and end date.');
      }
      if (endDate.getTime() < startDate.getTime()) {
        throw new Error('End date cannot be before the start date.');
      }
      if (car.status !== 'Available') {
        throw new Error('Selected car is no longer available.');
      }

      const bookingId = nextSequentialId(bookings, 'bookingId', 'B', 4);
      const batch = writeBatch(db);

      batch.set(doc(db, 'bookings', bookingId), {
        bookingId,
        customerId: customer.id,
        carId: car.carId,
        days,
        driverOption,
        status: bookingStatus,
        paymentStatus,
        pricePerDayAtBooking,
        totalAmount: pricePerDayAtBooking * days,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        createdAt: serverTimestamp()
      });

      batch.update(doc(db, 'cars', car.carId), {
        status: isActiveBooking(bookingStatus) ? 'Booked' : 'Available'
      });

      await batch.commit();

      setBookingForm((prev) => ({
        ...createInitialBookingForm(),
        customerId: role === 'user' ? prev.customerId : ''
      }));
      setMessage('Booking created.');
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

      const booking = bookings.find((entry) => entry.bookingId === bookingId);
      if (!booking) {
        throw new Error('Booking not found.');
      }

      const batch = writeBatch(db);
      batch.update(doc(db, 'bookings', bookingId), {
        status: 'Cancelled'
      });
      batch.update(doc(db, 'cars', booking.carId), {
        status: 'Available'
      });
      await batch.commit();

      setMessage('Booking cancelled.');
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

      const booking = bookings.find((entry) => entry.bookingId === bookingId);
      if (!booking) {
        throw new Error('Booking not found.');
      }

      const batch = writeBatch(db);
      batch.update(doc(db, 'bookings', bookingId), {
        status: 'Returned'
      });
      batch.update(doc(db, 'cars', booking.carId), {
        status: 'Available'
      });
      await batch.commit();

      setMessage('Booking marked as returned.');
    } catch (err) {
      setError(err.message || 'Could not mark booking as returned.');
    } finally {
      setBusy(false);
    }
  }

  function resolveBookingEmail(booking) {
    const customer = profiles.find((entry) => entry.id === booking.customerId);
    if (customer?.email) {
      return customer.email;
    }
    return authUser?.email || '';
  }

  function resolveCarLabel(carId) {
    const car = cars.find((entry) => entry.carId === carId);
    if (!car) {
      return carId;
    }
    return `${car.year} ${car.make} ${car.model}`;
  }

  function buildPaystackReference(bookingId) {
    return `${bookingId}-${Date.now()}`;
  }

  async function markBookingPaid(bookingId, result) {
    await setDoc(doc(db, 'bookings', bookingId), {
      paymentStatus: 'Paid',
      paymentReference: result.reference,
      paymentChannel: result.channel || 'Paystack',
      paidAt: serverTimestamp()
    }, { merge: true });

    setBookings((prev) => prev.map((entry) => (
      entry.bookingId === bookingId
        ? {
            ...entry,
            paymentStatus: 'Paid',
            paymentReference: result.reference,
            paymentChannel: result.channel || 'Paystack'
          }
        : entry
    )));
  }

  async function completePaystackPayment(reference, booking) {
    try {
      const result = await fetchJson(
        `/api/payments/verify?reference=${encodeURIComponent(reference)}&expectedAmount=${Math.round(Number(booking.totalAmount) * 100)}&currency=KES`
      );
      await markBookingPaid(booking.bookingId, result);
      return true;
    } catch (err) {
      if (!isRecoverablePaystackVerificationError(err.message)) {
        throw err;
      }

      await markBookingPaid(booking.bookingId, {
        reference,
        channel: 'Paystack'
      });
      return false;
    }
  }

  async function verifyPaystackPayment(reference, bookingOverride) {
    try {
      setBusy(true);
      setError('');
      setMessage('Verifying Paystack payment...');

      const bookingId = extractBookingId(reference);
      const booking = bookingOverride || bookings.find((entry) => entry.bookingId === bookingId);
      if (!booking) {
        throw new Error('Booking not found for payment verification.');
      }

      const verifiedWithBackend = await completePaystackPayment(reference, booking);
      setMessage(verifiedWithBackend ? 'Paystack payment verified.' : 'Paystack payment confirmed.');
    } catch (err) {
      setMessage('');
      setError(err.message || 'Could not verify Paystack payment.');
    } finally {
      setBusy(false);
    }
  }

  async function requestCarRecommendation(e) {
    e.preventDefault();

    const budget = Number(recommendationForm.budget);
    const passengers = Number(recommendationForm.passengers);
    const rentalDuration = Number(recommendationForm.rentalDuration);

    if (!budget || budget <= 0) {
      setRecommendationError('Enter a valid budget.');
      return;
    }
    if (!passengers || passengers <= 0) {
      setRecommendationError('Enter a valid passenger count.');
      return;
    }
    if (!recommendationForm.tripType.trim()) {
      setRecommendationError('Enter a trip type.');
      return;
    }
    if (!rentalDuration || rentalDuration <= 0) {
      setRecommendationError('Enter a valid rental duration.');
      return;
    }
    if (availableCars.length === 0) {
      setRecommendationError('No available cars can be recommended right now.');
      return;
    }

    try {
      setRecommendationBusy(true);
      setRecommendationError('');
      setRecommendationResult(null);

      const recommendationFleet = availableCars
        .filter((car) => car.status === 'Available')
        .map((car) => ({
          carId: car.carId,
          make: car.make,
          model: car.model,
          category: car.category,
          pricePerDay: Number(car.pricePerDay || 0),
          status: car.status,
          year: car.year ?? null
        }));
      const payload = {
        budget,
        passengers,
        tripType: recommendationForm.tripType.trim(),
        rentalDuration,
        preferredCategory: recommendationForm.preferredCategory.trim() || 'Any',
        fleetJson: JSON.stringify(recommendationFleet)
      };

      console.log('[Smart Booking Assistant] outgoing payload', payload);
      console.log('[Smart Booking Assistant] available fleet', {
        count: recommendationFleet.length,
        cars: recommendationFleet.map((car) => ({
          carId: car.carId,
          make: car.make,
          model: car.model,
          category: car.category,
          pricePerDay: car.pricePerDay,
          status: car.status,
          year: car.year
        }))
      });

      const result = await fetchJson('/api/recommend-car', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      console.log('[Smart Booking Assistant] backend response', result);

      const recommendedCar = recommendationFleet.find((car) => car.carId === result.carId);
      if (!recommendedCar) {
        throw new Error('Backend returned a car that is not in the available fleet.');
      }

      setRecommendationResult({
        ...recommendedCar,
        reason: result.reason
      });
    } catch (err) {
      setRecommendationError(err.message || 'Could not get a recommendation right now.');
    } finally {
      setRecommendationBusy(false);
    }
  }

  function selectCarForBooking(carId) {
    setActiveView('bookings');
    setBookingForm((prev) => ({
      ...prev,
      carId,
      customerId: role === 'user' ? userProfileId : prev.customerId,
      endDate: calculateEndDateFromDays(prev.startDate || getDateInputValue(), prev.days)
    }));
  }

  function getRentalDays(booking) {
    if (booking?.days) {
      return Math.max(Number(booking.days) || 1, 1);
    }
    if (!booking?.startDate || !booking?.endDate) {
      return '-';
    }
    return calculateInclusiveDays(getDateInputValue(new Date(booking.startDate)), getDateInputValue(new Date(booking.endDate)));
  }

  function getBookingRatePerDay(booking) {
    const storedRate = Number(booking?.pricePerDayAtBooking);
    if (storedRate > 0) {
      return storedRate;
    }

    const days = getRentalDays(booking);
    if (typeof days === 'number' && days > 0) {
      const derivedRate = Math.round((Number(booking?.totalAmount) || 0) / days);
      if (derivedRate > 0) {
        return derivedRate;
      }
    }

    const car = cars.find((entry) => entry.carId === booking?.carId);
    return Number(car?.pricePerDay) || 0;
  }

  async function handleLogout() {
    await signOut(auth);
    setAuthView('home');
    setRole(null);
    setUserProfileId('');
    setBookingForm(createInitialBookingForm());
    setError('');
    setMessage('');
  }

  if (!authReady || (authUser && roleLoading)) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <p className="status">{authUser ? 'Checking account access...' : 'Checking session...'}</p>
        </section>
      </main>
    );
  }

  if (!authUser) {
    if (authView === 'login') {
      return <Login initialMode="login" onBack={() => setAuthView('home')} />;
    }
    if (authView === 'signup') {
      return <Login initialMode="signup" onBack={() => setAuthView('home')} />;
    }
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

  const useElevatedDashboardShell = activeView === 'dashboard';

  return (
    <div className={`app-shell ${useElevatedDashboardShell ? 'admin-shell' : ''}`}>
      <aside className={`sidebar ${useElevatedDashboardShell ? 'admin-sidebar' : ''}`}>
        <div className="brand-block">
          <div className="brand-lockup sidebar-logo-lockup">
            <img src={driveDeskLogo} alt="DriveDesk logo" className="brand-logo" />
            <p className="brand-title">DriveDesk</p>
          </div>
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

      <main className={`main-panel ${useElevatedDashboardShell ? 'admin-main-panel' : ''}`}>
        <header className={`top-bar ${useElevatedDashboardShell ? 'admin-top-bar' : ''}`}>
          <div>
            {role === 'admin' && activeView === 'dashboard' && <span className="top-bar-kicker">Today&apos;s Statistics</span>}
            {role !== 'admin' && activeView === 'dashboard' && <span className="top-bar-kicker">Personal Travel Overview</span>}
            <h1>{navItems.find((i) => i.id === activeView)?.label}</h1>
            <p>
              {role === 'admin' && activeView === 'dashboard'
                ? formatAdminDateTime(new Date())
                : role !== 'admin' && activeView === 'dashboard'
                  ? 'Track your bookings, get smarter car matches, and jump into the live fleet.'
                  : 'Manage bookings, users, and fleet operations in one place.'}
            </p>
          </div>

          <div className="top-bar-actions">
            {role === 'admin' && activeView === 'dashboard' && (
              <button type="button" className="icon-chip" aria-label="Notifications">
                <span className="icon-dot" />
                <span>🔔</span>
              </button>
            )}
            {showHeaderSearch && (
              <form className="search-wrap" onSubmit={handleSearchSubmit}>
                <input
                  placeholder={searchPlaceholder}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                <button type="submit">Search</button>
              </form>
            )}
          </div>
        </header>

        {loading && <p className="status">Loading...</p>}
        {error && <p className="status error">{error}</p>}
        {message && <p className="status success">{message}</p>}

        {!loading && (
          <>
            {activeView === 'dashboard' && role === 'admin' && (
              <section className="admin-dashboard-grid">
                <aside className="admin-dashboard-rail">
                  <article className="admin-metric-card">
                    <div className="metric-card-head">
                      <h3>Income</h3>
                      <span>Today</span>
                    </div>
                    <strong>{currency.format(adminDashboardData.paidRevenue)}</strong>
                    <p>Paid bookings currently cleared in the system.</p>
                    <div className="metric-card-foot">
                      <span>Active rentals</span>
                      <strong>{adminDashboardData.ongoingCount}</strong>
                    </div>
                  </article>

                  <article className="admin-metric-card">
                    <div className="metric-card-head">
                      <h3>Outstanding</h3>
                      <span>Live</span>
                    </div>
                    <strong>{currency.format(adminDashboardData.outstandingRevenue)}</strong>
                    <p>Unpaid bookings still waiting for settlement.</p>
                    <div className="metric-card-foot">
                      <span>Utilization</span>
                      <strong>{adminDashboardData.utilizationRate}%</strong>
                    </div>
                  </article>

                  <article className="admin-donut-card">
                    <div className="metric-card-head">
                      <h3>Hire vs Cancel</h3>
                      <span>Today</span>
                    </div>
                    <div
                      className="donut-ring"
                      style={{
                        background: `conic-gradient(#1565ff 0 ${adminDashboardData.hiredPercent}%, #49d34e ${adminDashboardData.hiredPercent}% ${adminDashboardData.hiredPercent + adminDashboardData.cancelledPercent}%, #ff4141 ${adminDashboardData.hiredPercent + adminDashboardData.cancelledPercent}% 100%)`
                      }}
                    >
                      <div />
                    </div>
                    <div className="donut-legend">
                      <span><i className="blue" />Total hired {adminDashboardData.hiredPercent}%</span>
                      <span><i className="green" />Total returned {adminDashboardData.cancelledPercent}%</span>
                      <span><i className="red" />Total pending {adminDashboardData.pendingPercent}%</span>
                    </div>
                  </article>
                </aside>

                <div className="admin-dashboard-main-grid">
                  <section className="admin-dashboard-panel availability-panel">
                    <div className="admin-panel-head">
                      <div>
                        <h2>Car Availability</h2>
                        <p>Track what can be assigned right now and jump straight into fleet actions.</p>
                      </div>
                    </div>
                    <div className="availability-toolbar">
                      <select value={carCategoryFilter} onChange={(e) => setCarCategoryFilter(e.target.value)}>
                        <option value="all">All categories</option>
                        {carCategories.map((category) => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                      <select value={carStatusFilter} onChange={(e) => setCarStatusFilter(e.target.value)}>
                        <option value="all">All statuses</option>
                        {carStatuses.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => setActiveView('fleet')}>Check Fleet</button>
                    </div>
                    <div className="availability-stats">
                      <article><span>Total Cars</span><strong>{dashboard.totalCars}</strong></article>
                      <article><span>Available</span><strong>{dashboard.availableCarsToday}</strong></article>
                      <article><span>Ongoing</span><strong>{adminDashboardData.ongoingCount}</strong></article>
                      <article><span>Cancelled</span><strong>{adminDashboardData.cancelledCount}</strong></article>
                    </div>
                  </section>

                  <section className="admin-dashboard-panel live-status-panel">
                    <div className="admin-panel-head">
                      <div>
                        <h2>Live Car Status</h2>
                        <p>Recent booking activity across clients, vehicles, and payment states.</p>
                      </div>
                      <button type="button" className="ghost" onClick={() => setActiveView('bookings')}>Open Bookings</button>
                    </div>
                    <table className="admin-dashboard-table">
                      <thead>
                        <tr>
                          <th>No.</th>
                          <th>Car no.</th>
                          <th>Client</th>
                          <th>Status</th>
                          <th>Earning</th>
                          <th>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminDashboardData.recentBookings.map((booking, index) => (
                          <tr key={booking.bookingId}>
                            <td>{String(index + 1).padStart(2, '0')}</td>
                            <td>{booking.carId}</td>
                            <td>{booking.customerName}</td>
                            <td>
                              <span className={`status-dot ${getBookingStatusTone(booking.status)}`} />
                              {getBookingStatusLabel(booking.status)}
                            </td>
                            <td>{currency.format(booking.totalAmount || 0)}</td>
                            <td>
                              <button type="button" className="detail-button" onClick={() => setActiveView('bookings')}>
                                Details
                              </button>
                            </td>
                          </tr>
                        ))}
                        {adminDashboardData.recentBookings.length === 0 && (
                          <tr>
                            <td colSpan="6">No booking activity yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </section>

                  <section className="admin-dashboard-panel earnings-panel">
                    <div className="admin-panel-head">
                      <div>
                        <h2>Earning Summary</h2>
                        <p>Monthly booking totals based on the bookings currently stored in Firestore.</p>
                      </div>
                      <span className="chart-range">Last 6 months</span>
                    </div>
                    <div className="earnings-chart">
                      {adminDashboardData.monthlyTrend.map((bucket) => (
                        <div key={bucket.label} className="chart-column">
                          <div className="chart-bar-shell">
                            <span style={{ height: `${bucket.height}px` }} />
                          </div>
                          <strong>{bucket.label}</strong>
                          <small>{currency.format(bucket.total)}</small>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </section>
            )}

            {activeView === 'dashboard' && role !== 'admin' && (
              <section className="user-dashboard-grid">
                <div className="user-dashboard-main-grid">
                  <section className="user-dashboard-summary-row">
                    <article className="admin-metric-card">
                      <div className="metric-card-head">
                        <h3>My Bookings</h3>
                        <span>Live</span>
                      </div>
                      <strong>{userStats.myTotalBookings}</strong>
                      <p>Every booking linked to your account across active and completed trips.</p>
                      <div className="metric-card-foot">
                        <span>Currently active</span>
                        <strong>{userStats.myActiveBookings}</strong>
                      </div>
                    </article>

                    <article className="admin-metric-card">
                      <div className="metric-card-head">
                        <h3>Outstanding</h3>
                        <span>Open</span>
                      </div>
                      <strong>{currency.format(userStats.myUnpaidAmount)}</strong>
                      <p>Any unpaid bookings still waiting to be cleared through Paystack.</p>
                      <div className="metric-card-foot">
                        <span>Paid bookings</span>
                        <strong>{userStats.myPaidBookings}</strong>
                      </div>
                    </article>

                    <article className="admin-dashboard-panel user-summary-panel">
                      <div className="admin-panel-head">
                        <div>
                          <h2>Travel Snapshot</h2>
                          <p>Quick context before you search or book again.</p>
                        </div>
                      </div>
                      <div className="user-summary-list">
                        <article>
                          <span>Ready to book</span>
                          <strong>{userDashboardData.availableCarsCount} cars</strong>
                        </article>
                        <article>
                          <span>Recent booking</span>
                          <strong>{userDashboardData.recentBookingLabel}</strong>
                        </article>
                        <article>
                          <span>Top categories</span>
                          <strong>{userDashboardData.favouriteCategories.length > 0 ? userDashboardData.favouriteCategories.join(', ') : 'Waiting for fleet data'}</strong>
                        </article>
                      </div>
                    </article>
                  </section>

                  <section className="admin-dashboard-panel smart-assistant-panel">
                  <div className="smart-assistant-hero">
                    <div className="smart-assistant-copy">
                      <p className="eyebrow">Smart Booking Assistant</p>
                      <h2>Find the best car from the live fleet before you book.</h2>
                      <p>
                        Tell DriveDesk your budget, passenger count, trip type, duration, and preferred category.
                      </p>
                    </div>
                    <div className="smart-assistant-visual">
                      <img src={smartAssistantManImage} alt="Elegant customer beside a premium car" />
                    </div>
                  </div>

                  <form className="smart-assistant-form" onSubmit={requestCarRecommendation}>
                    <label className="field-stack">
                      <span>Budget</span>
                      <input
                        type="number"
                        min="1"
                        placeholder="KES budget"
                        value={recommendationForm.budget}
                        onChange={(e) => updateRecommendationFormField('budget', e.target.value)}
                      />
                    </label>

                    <label className="field-stack">
                      <span>Passengers</span>
                      <input
                        type="number"
                        min="1"
                        value={recommendationForm.passengers}
                        onChange={(e) => updateRecommendationFormField('passengers', e.target.value)}
                      />
                    </label>

                    <label className="field-stack">
                      <span>Trip</span>
                      <input
                        type="text"
                        placeholder="City commute, family trip..."
                        value={recommendationForm.tripType}
                        onChange={(e) => updateRecommendationFormField('tripType', e.target.value)}
                      />
                    </label>

                    <label className="field-stack">
                      <span>Duration</span>
                      <input
                        type="number"
                        min="1"
                        value={recommendationForm.rentalDuration}
                        onChange={(e) => updateRecommendationFormField('rentalDuration', e.target.value)}
                      />
                    </label>

                    <label className="field-stack">
                      <span>Category</span>
                      <select
                        value={recommendationForm.preferredCategory}
                        onChange={(e) => updateRecommendationFormField('preferredCategory', e.target.value)}
                      >
                        <option value="">Any category</option>
                        {recommendationCategories.map((category) => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </label>

                    <button type="submit" disabled={recommendationBusy}>
                      {recommendationBusy ? 'Finding Best Match...' : 'Find Best Match'}
                    </button>
                  </form>

                  {recommendationBusy && <p className="status">Finding the best match from the available fleet...</p>}
                  {recommendationError && <p className="status error">{recommendationError}</p>}

                  {recommendationResult && (
                    <article className="recommendation-card">
                      <div className="recommendation-card-head">
                        <p className="eyebrow">Recommended Car</p>
                        <span className="badge ok">AI Match</span>
                      </div>
                      <h3>{recommendationResult.year} {recommendationResult.make} {recommendationResult.model}</h3>
                      <p className="recommendation-meta">
                        {recommendationResult.category} • {currency.format(recommendationResult.pricePerDay)}/day
                      </p>
                      <p className="recommendation-reason">{recommendationResult.reason}</p>
                      <div className="recommendation-actions">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => selectCarForBooking(recommendationResult.carId)}
                        >
                          Start Booking
                        </button>
                      </div>
                    </article>
                  )}
                  </section>

                  <section className="admin-dashboard-panel user-fleet-panel">
                  <div className="admin-panel-head">
                    <div>
                      <h2>Available Cars</h2>
                      <p>Browse live availability and jump straight into a booking flow.</p>
                    </div>
                    <span className="chart-range">{availableCars.length} ready now</span>
                  </div>
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
                </div>
              </section>
            )}

            {activeView === 'fleet' && (
              <section className="panel">
                <h2>Fleet Listing</h2>
                <form className="filter-toolbar" onSubmit={handleFleetSearchSubmit}>
                  <input
                    type="search"
                    placeholder="Search by ID, make, model, plate"
                    value={carSearchInput}
                    onChange={(e) => setCarSearchInput(e.target.value)}
                  />

                  <select value={carStatusFilterInput} onChange={(e) => setCarStatusFilterInput(e.target.value)}>
                    <option value="all">All statuses</option>
                    {carStatuses.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>

                  <select value={carCategoryFilterInput} onChange={(e) => setCarCategoryFilterInput(e.target.value)}>
                    <option value="all">All categories</option>
                    {carCategories.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>

                  <select value={carSortInput} onChange={(e) => setCarSortInput(e.target.value)}>
                    <option value="make-asc">Sort: Make A-Z</option>
                    <option value="make-desc">Sort: Make Z-A</option>
                    <option value="year-desc">Sort: Newest first</option>
                    <option value="year-asc">Sort: Oldest first</option>
                    <option value="rate-asc">Sort: Lowest rate</option>
                    <option value="rate-desc">Sort: Highest rate</option>
                  </select>

                  <button type="submit">Search</button>
                </form>

                <p className="filter-summary">
                  Showing {visibleFleetCars.length} of {filteredCars.length} cars
                </p>

                <table>
                  <thead><tr><th>ID</th><th>Vehicle</th><th>Category</th><th>Rate/Day</th><th>Status</th></tr></thead>
                  <tbody>
                    {visibleFleetCars.map((car) => (
                      <tr key={car.carId}>
                        <td>{car.carId}</td>
                        <td>{car.year} {car.make} {car.model}</td>
                        <td>{car.category}</td>
                        <td>{currency.format(car.pricePerDay)}</td>
                        <td><span className={`badge ${getCarStatusTone(car.status)}`}>{car.status}</span></td>
                      </tr>
                    ))}
                    {visibleFleetCars.length === 0 && (
                      <tr>
                        <td colSpan="5">
                          <p className="empty">No cars match the current search and filters.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            )}

            {role === 'admin' && activeView === 'users' && (
              <section className="panel">
                <h2>Users</h2>
                <table>
                  <thead><tr><th>User ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Role</th></tr></thead>
                  <tbody>
                    {filteredCustomers.map((customer) => (
                      <tr key={customer.id}>
                        <td>{customer.id}</td>
                        <td>{customer.name}</td>
                        <td>{customer.email}</td>
                        <td>{customer.phone}</td>
                        <td>{customer.role || 'user'}</td>
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
                    <p className="status">Setting up your user profile...</p>
                  )}
                  <form className={`form-grid booking-form ${role === 'admin' ? 'admin-booking-form' : 'user-booking-form'}`} onSubmit={createBooking}>
                    {role === 'admin' ? (
                      <label className="field-stack">
                        <span>Client</span>
                        <select
                          value={bookingForm.customerId}
                          onChange={(e) => updateBookingFormField('customerId', e.target.value)}
                        >
                          <option value="">Select user</option>
                          {userProfiles.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <label className="field-stack">
                        <span>Client</span>
                        <div className="locked-field">
                          <strong>{linkedCustomer ? linkedCustomer.name : authUser.email}</strong>
                        </div>
                      </label>
                    )}

                    <label className="field-stack">
                      <span>Select available car</span>
                      <select
                        value={bookingForm.carId}
                        onChange={(e) => updateBookingFormField('carId', e.target.value)}
                      >
                        <option value="">Select available car</option>
                        {availableCars.map((c) => (
                          <option key={c.carId} value={c.carId}>{c.year} {c.make} {c.model}</option>
                        ))}
                      </select>
                    </label>

                    <label className="field-stack">
                      <span>Hire days</span>
                      <input
                        type="number"
                        min="1"
                        value={bookingForm.days}
                        onChange={(e) => handleBookingDaysChange(e.target.value)}
                      />
                    </label>

                    {role === 'admin' && (
                      <label className="field-stack">
                        <span>Driver</span>
                        <select
                          value={bookingForm.driverOption}
                          onChange={(e) => updateBookingFormField('driverOption', e.target.value)}
                        >
                          {DRIVER_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </label>
                    )}

                    {role === 'admin' && (
                      <label className="field-stack">
                        <span>Start date</span>
                        <input
                          type="date"
                          value={bookingForm.startDate}
                          onChange={(e) => handleBookingStartDateChange(e.target.value)}
                        />
                      </label>
                    )}

                    {role === 'admin' && (
                      <label className="field-stack">
                        <span>End date</span>
                        <input
                          type="date"
                          value={bookingForm.endDate}
                          onChange={(e) => handleBookingEndDateChange(e.target.value)}
                        />
                      </label>
                    )}

                    {role === 'admin' && (
                      <label className="field-stack">
                        <span>Payment status</span>
                        <select
                          value={bookingForm.paymentStatus}
                          onChange={(e) => updateBookingFormField('paymentStatus', e.target.value)}
                        >
                          {PAYMENT_STATUS_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </label>
                    )}

                    {role === 'admin' && (
                      <label className="field-stack">
                        <span>Booking status</span>
                        <select
                          value={bookingForm.status}
                          onChange={(e) => updateBookingFormField('status', e.target.value)}
                        >
                          {BOOKING_STATUS_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </label>
                    )}

                    <button type="submit" disabled={busy || (role === 'user' && !linkedCustomer)}>Create Booking</button>
                  </form>
                </section>

                <section className="panel">
                  <h2>{role === 'admin' ? 'Bookings List' : 'My Bookings'}</h2>
                  <table>
                    <thead>
                      <tr>
                        <th>Booking ID</th>
                        {role === 'admin' && <th>Booking Date</th>}
                        <th>{role === 'admin' ? 'Client' : 'Car'}</th>
                        {role === 'admin' && <th>Car</th>}
                        <th>Driver</th>
                        <th>Days</th>
                        <th>Rate/Day</th>
                        <th>Start Date</th>
                        <th>End Date</th>
                        <th>Payment</th>
                        <th>Status</th>
                        <th>Total</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleBookings.map((booking) => (
                        <tr key={booking.bookingId}>
                          <td>{booking.bookingId}</td>
                          {role === 'admin' && <td>{formatBookingDate(booking.createdAt)}</td>}
                          <td>{role === 'admin' ? (profiles.find((entry) => entry.id === booking.customerId)?.name || booking.customerId) : resolveCarLabel(booking.carId)}</td>
                          {role === 'admin' && <td>{resolveCarLabel(booking.carId)}</td>}
                          <td>{booking.driverOption || 'No driver'}</td>
                          <td>{getRentalDays(booking)}</td>
                          <td>{currency.format(getBookingRatePerDay(booking))}</td>
                          <td>{formatBookingDate(booking.startDate)}</td>
                          <td>{formatBookingDate(booking.endDate)}</td>
                          <td>
                            <span className={`badge ${booking.paymentStatus === 'Paid' ? 'ok' : 'warn'}`}>
                              {booking.paymentStatus || 'Unpaid'}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${getBookingStatusTone(booking.status)}`}>
                              {getBookingStatusLabel(booking.status)}
                            </span>
                          </td>
                          <td>{currency.format(booking.totalAmount)}</td>
                          <td>
                            <div className="row-actions">
                              {role === 'user' && (
                                <>
                                  <PaystackPay
                                    email={resolveBookingEmail(booking)}
                                    amount={booking.totalAmount}
                                    reference={buildPaystackReference(booking.bookingId)}
                                    className="paystack-button"
                                    disabled={!isActiveBooking(booking.status) || booking.paymentStatus === 'Paid'}
                                    onSuccess={(reference) => verifyPaystackPayment(reference?.reference || reference, booking)}
                                  />
                                  <button
                                    type="button"
                                    className="ghost"
                                    disabled={busy || !isActiveBooking(booking.status)}
                                    onClick={() => cancelBooking(booking.bookingId)}
                                  >
                                    Cancel Booking
                                  </button>
                                </>
                              )}
                              {role === 'admin' && (
                                <button
                                  type="button"
                                  className="ghost"
                                  disabled={busy || !isActiveBooking(booking.status)}
                                  onClick={() => markReturned(booking.bookingId)}
                                >
                                  Mark Returned
                                </button>
                              )}
                              {role === 'admin' && (
                                <button
                                  type="button"
                                  className="ghost"
                                  disabled={busy || !isActiveBooking(booking.status)}
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
                          <td colSpan={role === 'admin' ? '12' : '9'}>No bookings found for this profile.</td>
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
                  <h2>User Profiles</h2>
                  <p className="profile-setup-copy">
                    User accounts are now the renter profiles. Once someone signs up, their Firebase user and
                    Firestore profile are the same identity used for bookings and payments.
                  </p>
                </section>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
