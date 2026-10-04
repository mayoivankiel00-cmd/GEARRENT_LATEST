import ReturnInspections from '../components/ReturnInspections';
import AdminLayout from './AdminLayout';
import './AdminMetricPages.css';

export default function AdminReturns() {
  return (
    <AdminLayout>
      <div className="metric-page-heading">
        <div>
          <span className="mono metric-page-kicker">Rental check-in</span>
          <h1 className="admin-title">Gear <span className="accent">Returns</span></h1>
          <p>
            Rentals stay open until the gear is checked. Confirm Gear Rent&apos;s own gear here; providers confirm theirs,
            but you can step in on any return.
          </p>
        </div>
      </div>
      <ReturnInspections title="Awaiting inspection" />
    </AdminLayout>
  );
}
