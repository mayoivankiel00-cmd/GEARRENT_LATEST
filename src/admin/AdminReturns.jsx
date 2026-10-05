import ReturnInspections from '../components/ReturnInspections';
import RentalHandovers from '../components/RentalHandovers';
import AdminLayout from './AdminLayout';
import './AdminMetricPages.css';

export default function AdminReturns() {
  return (
    <AdminLayout>
      <div className="metric-page-heading">
        <div>
          <span className="mono metric-page-kicker">Rental check-in</span>
          <h1 className="admin-title">Handovers <span className="accent">&amp; Returns</span></h1>
          <p>
            A renter&apos;s time starts when the gear is handed over, and the rental stays open until the gear is checked
            back in. Handle Gear Rent&apos;s own gear here; providers handle theirs, but you can step in on any rental.
          </p>
        </div>
      </div>
      <RentalHandovers title="Waiting for handover" />
      <ReturnInspections title="Awaiting inspection" />
    </AdminLayout>
  );
}
