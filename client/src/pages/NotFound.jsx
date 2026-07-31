import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="grid h-full place-items-center p-6">
      <EmptyState
        icon={Compass}
        title="Page not found"
        message="That page does not exist, or you may not have access to it."
        action={
          <Link to="/" className="btn-primary">
            Back to dashboard
          </Link>
        }
      />
    </div>
  );
}
