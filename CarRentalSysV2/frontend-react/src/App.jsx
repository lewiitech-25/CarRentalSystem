import { useEffect, useState } from 'react';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 0
});

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [cars, setCars] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError('');
        const [dashRes, carsRes, customersRes, bookingsRes] = await Promise.all([
          fetch('/api/dashboard'),
          fetch('/api/cars'),
          fetch('/api/customers'),
          fetch('/api/bookings')
        ]);

        if (!dashRes.ok || !carsRes.ok || !customersRes.ok || !bookingsRes.ok) {
          throw new Error('API request failed');
        }

        const [dashData, carsData, customersData, bookingsData] = await Promise.all([
          dashRes.json(),
          carsRes.json(),
          customersRes.json(),
          bookingsRes.json()
        ]);

        if (!active) {
          return;
        }

        setDashboard(dashData);
        setCars(carsData);
        setCustomers(customersData);
        setBookings(bookingsData);
      } catch (err) {
        if (active) {
          setError('Could not load data. Make sure the Java API is running on port 8080.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="page">
      <header className="hero">
        <h1>Car Rental Dashboard</h1>
        <p>React frontend connected to your Java rental system.</p>
      </header>

      {loading && <p className="status">Loading dashboard...</p>}
      {error && <p className="status error">{error}</p>}

      {!loading && !error && dashboard && (
        <>
          <section className="cards">
            <article className="card">
              <h2>Total Cars</h2>
              <strong>{dashboard.totalCars}</strong>
            </article>
            <article className="card">
              <h2>Total Customers</h2>
              <strong>{dashboard.totalCustomers}</strong>
            </article>
            <article className="card">
              <h2>Available Today</h2>
              <strong>{dashboard.availableCarsToday}</strong>
            </article>
            <article className="card">
              <h2>Active Bookings</h2>
              <strong>{dashboard.activeBookingsToday}</strong>
            </article>
            <article className="card card-wide">
              <h2>Total Revenue</h2>
              <strong>{currency.format(dashboard.totalRevenue)}</strong>
            </article>
          </section>

          <section className="panel">
            <h3>Cars</h3>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Vehicle</th>
                  <th>Category</th>
                  <th>Rate / Day</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {cars.map((car) => (
                  <tr key={car.carId}>
                    <td>{car.carId}</td>
                    <td>{car.year} {car.make} {car.model}</td>
                    <td>{car.category}</td>
                    <td>{currency.format(car.pricePerDay)}</td>
                    <td>{car.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="panel">
            <h3>Customers</h3>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
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

          <section className="panel">
            <h3>Bookings</h3>
            <table>
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Customer</th>
                  <th>Car</th>
                  <th>Status</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.bookingId}>
                    <td>{booking.bookingId}</td>
                    <td>{booking.customerId}</td>
                    <td>{booking.carId}</td>
                    <td>{booking.status}</td>
                    <td>{currency.format(booking.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}
