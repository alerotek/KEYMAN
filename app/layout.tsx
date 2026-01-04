import { getRole } from '../lib/requireRole';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const role = await getRole();

  return (
    <html lang="en">
      <body>
        <nav className="bg-gray-800 text-white p-4">
          <div className="container mx-auto flex justify-between">
            <h1 className="text-xl font-bold">Keyman Hotel</h1>
            <div className="space-x-4">
              <a href="/" className="hover:underline">Home</a>
              {role && (
                <>
                  {['admin', 'manager', 'staff'].includes(role) && (
                    <a href="/dashboard/reception" className="hover:underline">Reception</a>
                  )}
                  {['admin', 'manager'].includes(role) && (
                    <a href="/dashboard/manager" className="hover:underline">Manager</a>
                  )}
                  {role === 'admin' && (
                    <a href="/admin" className="hover:underline">Admin</a>
                  )}
                  <a href="/my-bookings" className="hover:underline">My Bookings</a>
                </>
              )}
            </div>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
