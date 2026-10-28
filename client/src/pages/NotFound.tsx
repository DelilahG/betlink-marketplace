import { Link } from 'react-router-dom';

export function NotFound({ title = 'We could not find that page', body = 'The link may be broken, or the listing may have been removed or already rented.' }: { title?: string; body?: string }) {
  return (
    <div className="container center-page">
      <div>
        <p className="eyebrow">404</p>
        <h1 className="h1" style={{ margin: '12px 0' }}>{title}</h1>
        <p className="muted">{body}</p>
        <div className="row" style={{ justifyContent: 'center', marginTop: 24 }}>
          <Link to="/rent" className="btn">Browse rentals</Link>
          <Link to="/" className="btn btn-ghost">Go home</Link>
        </div>
      </div>
    </div>
  );
}
