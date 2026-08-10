import { useAuth } from '../hooks/useAuth'
import PageHeader from '../components/common/PageHeader'

export default function Profile() {
  const { user } = useAuth()

  return (
    <div className="page">
      <PageHeader title="Profile" subtitle="Your account information" />

      <div className="profile-card card">
        <div className="profile-card__avatar">
          {user?.name?.charAt(0) ?? 'U'}
        </div>
        <dl className="profile-card__details">
          <dt>Name</dt>
          <dd>{user?.name}</dd>
          <dt>Email</dt>
          <dd>{user?.email}</dd>
          <dt>Role</dt>
          <dd>{user?.role}</dd>
        </dl>
      </div>
    </div>
  )
}
