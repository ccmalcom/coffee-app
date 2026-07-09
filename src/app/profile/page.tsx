import { getProfileView } from '@/lib/actions/taste'
import { ProfileView } from '@/components/profile/ProfileView'

export default async function ProfilePage() {
  const view = await getProfileView()
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-4 pb-20">
      <h1 className="text-xl font-semibold">Your taste profile</h1>
      <ProfileView view={view} />
    </main>
  )
}
